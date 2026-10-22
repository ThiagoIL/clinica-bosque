"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearAccessCache } from "@/lib/access";
import { UserError, checkbox, formValues, optional, parseForm, required, type FormState } from "@/lib/form";
import { MODULES, MODULE_KEYS, moduleLabel } from "@/lib/modules";
import { createPlatformSession, destroyPlatformSession, getPlatformBase } from "@/lib/platform-auth";
import { logPlatformEvent, runPlatformAction } from "@/lib/platform-action";

// ───────────────────────── login ─────────────────────────

// Limitador simples em memória: 5 falhas / 15 min por e-mail + IP.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("senha-inexistente", 12));

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Informe o e-mail"),
  password: z.string().min(1, "Informe a senha"),
});

export async function platformLogin(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(loginSchema, formData);
  if (parsed.state) return { ...parsed.state, values: { email: formValues(formData).email ?? "" } };
  const { email, password } = parsed.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${email}|${ip}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && now - entry.first > WINDOW_MS) attempts.delete(key);
  if ((attempts.get(key)?.count ?? 0) >= MAX_ATTEMPTS) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.", values: { email } };
  }

  const admin = await db.platformAdmin.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, admin?.passwordHash ?? getDummyHash());
  if (!admin || !admin.active || !valid) {
    attempts.set(key, { count: (attempts.get(key)?.count ?? 0) + 1, first: attempts.get(key)?.first ?? now });
    return { error: "E-mail ou senha incorretos.", values: { email } };
  }

  attempts.delete(key);
  await createPlatformSession(admin.id);
  redirect((await getPlatformBase()) || "/");
}

export async function platformLogout() {
  const base = await getPlatformBase();
  await destroyPlatformSession();
  redirect(`${base}/login`);
}

// ───────────────────────── bloqueio ─────────────────────────

const blockSchema = z.object({
  blocked: z.enum(["0", "1"]),
  message: optional(1000),
});

/** Bloqueia ou libera o sistema da clínica (ex.: falta de pagamento). */
export async function setSystemBlock(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(blockSchema, formData);
  if (parsed.state) return parsed.state;
  const blocked = parsed.data.blocked === "1";
  const message = parsed.data.message;

  return runPlatformAction(formData, async (admin) => {
    const before = await db.systemSettings.findUnique({ where: { id: "singleton" } });
    await db.systemSettings.upsert({
      where: { id: "singleton" },
      update: { blocked, blockMessage: message, blockedAt: blocked ? (before?.blocked ? before.blockedAt : new Date()) : null },
      create: { id: "singleton", blocked, blockMessage: message, blockedAt: blocked ? new Date() : null },
    });
    clearAccessCache();

    if (blocked && !before?.blocked) await logPlatformEvent("BLOCK", "Sistema bloqueado", admin.email);
    else if (!blocked && before?.blocked) await logPlatformEvent("UNBLOCK", "Sistema liberado", admin.email);
    else if (blocked) await logPlatformEvent("BLOCK_MESSAGE", "Mensagem de bloqueio atualizada", admin.email);

    return { success: blocked ? "Sistema bloqueado. Os usuários da clínica já não conseguem acessar." : "Sistema liberado." };
  });
}

// ───────────────────────── módulos ─────────────────────────

export async function saveEnabledModules(_: FormState, formData: FormData): Promise<FormState> {
  return runPlatformAction(formData, async (admin) => {
    const enabled = MODULES.filter((m) => formData.get(`module_${m.key}`) === "on").map((m) => m.key);
    const before = await db.systemSettings.findUnique({ where: { id: "singleton" } });
    await db.systemSettings.upsert({
      where: { id: "singleton" },
      update: { enabledModules: enabled },
      create: { id: "singleton", enabledModules: enabled },
    });
    clearAccessCache();

    const previous = new Set(before?.enabledModules ?? []);
    const added = enabled.filter((k) => !previous.has(k)).map(moduleLabel);
    const removed = MODULE_KEYS.filter((k) => previous.has(k) && !enabled.includes(k)).map(moduleLabel);
    if (added.length || removed.length) {
      await logPlatformEvent(
        "MODULES",
        [added.length ? `Liberados: ${added.join(", ")}` : null, removed.length ? `Removidos: ${removed.join(", ")}` : null]
          .filter(Boolean)
          .join(" · "),
        admin.email,
      );
    }
    return { success: "Módulos atualizados." };
  });
}

// ───────────────────────── minha conta ─────────────────────────

const accountSchema = z.object({
  name: required("Nome", 120),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
});

export async function updatePlatformAccount(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(accountSchema, formData);
  if (parsed.state) return parsed.state;
  const { name, currentPassword, newPassword, confirmPassword } = parsed.data;

  return runPlatformAction(formData, async (admin) => {
    if (!newPassword) {
      await db.platformAdmin.update({ where: { id: admin.id }, data: { name } });
      return { success: "Dados atualizados." };
    }
    if (newPassword.length < 10) {
      throw new UserError("A nova senha deve ter ao menos 10 caracteres.", { newPassword: "Mínimo de 10 caracteres" });
    }
    if (newPassword !== confirmPassword) {
      throw new UserError("A confirmação não confere com a nova senha.", { confirmPassword: "Não confere" });
    }
    const record = await db.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } });
    if (!currentPassword || !(await bcrypt.compare(currentPassword, record.passwordHash))) {
      throw new UserError("A senha atual está incorreta.", { currentPassword: "Senha atual incorreta" });
    }
    await db.platformAdmin.update({ where: { id: admin.id }, data: { name, passwordHash: await bcrypt.hash(newPassword, 12) } });
    await logPlatformEvent("PASSWORD", "Senha do fornecedor alterada", admin.email);
    return { success: "Senha alterada com sucesso." };
  });
}

// ───────────────────────── usuários do fornecedor ─────────────────────────

const MIN_PLATFORM_PASSWORD = 10;

const adminSchema = z.object({
  id: z.string().optional(),
  name: required("Nome", 120),
  email: z
    .string({ error: "E-mail é obrigatório" })
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido"),
  password: z.string().optional(),
  active: checkbox(),
});

/** Cria ou edita uma conta de acesso ao console do fornecedor. */
export async function savePlatformAdmin(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(adminSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, password, ...data } = parsed.data;

  return runPlatformAction(formData, async (current) => {
    if (password) {
      if (password.length < MIN_PLATFORM_PASSWORD) {
        throw new UserError(`A senha deve ter ao menos ${MIN_PLATFORM_PASSWORD} caracteres.`, {
          password: `Mínimo de ${MIN_PLATFORM_PASSWORD} caracteres`,
        });
      }
    } else if (!id) {
      throw new UserError("Defina uma senha para o novo usuário.", { password: "Senha é obrigatória" });
    }

    const sameEmail = await db.platformAdmin.findUnique({ where: { email: data.email } });
    if (sameEmail && sameEmail.id !== id) {
      throw new UserError("Já existe um usuário com este e-mail.", { email: "E-mail já cadastrado" });
    }

    if (id) {
      const target = await db.platformAdmin.findUnique({ where: { id } });
      if (!target) throw new UserError("Usuário não encontrado.");
      if (id === current.id && !data.active) throw new UserError("Você não pode desativar o seu próprio usuário.");
      if (target.active && !data.active) {
        const others = await db.platformAdmin.count({ where: { active: true, id: { not: id } } });
        if (others === 0) throw new UserError("É necessário manter ao menos um usuário ativo.");
      }
      await db.platformAdmin.update({
        where: { id },
        data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
      });
      await logPlatformEvent("USER", `Usuário atualizado: ${data.email}${password ? " (senha redefinida)" : ""}`, current.email);
    } else {
      await db.platformAdmin.create({ data: { ...data, passwordHash: await bcrypt.hash(password!, 12) } });
      await logPlatformEvent("USER", `Usuário criado: ${data.email}`, current.email);
    }
    return { redirectTo: `${await getPlatformBase()}/usuarios` };
  });
}
