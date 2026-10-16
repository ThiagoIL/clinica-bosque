"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, checkbox, parseForm, required, requiredEnum, type FormState } from "@/lib/form";

const MIN_PASSWORD = 8;

const userSchema = z.object({
  id: z.string().optional(),
  name: required("Nome", 120),
  email: z
    .string({ error: "E-mail é obrigatório" })
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido"),
  role: requiredEnum(["ADMIN", "STAFF"], "Perfil"),
  password: z.string().optional(),
  active: checkbox(),
});

export async function saveUser(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(userSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, password, ...data } = parsed.data;

  return runAction(formData, async (current) => {
    if (current.role !== "ADMIN") throw new UserError("Somente administradores podem gerenciar usuários.");

    if (password) {
      if (password.length < MIN_PASSWORD) {
        throw new UserError(`A senha deve ter ao menos ${MIN_PASSWORD} caracteres.`, { password: `Mínimo de ${MIN_PASSWORD} caracteres` });
      }
    } else if (!id) {
      throw new UserError("Defina uma senha para o novo usuário.", { password: "Senha é obrigatória" });
    }

    const sameEmail = await db.user.findUnique({ where: { email: data.email } });
    if (sameEmail && sameEmail.id !== id) {
      throw new UserError("Já existe um usuário com este e-mail.", { email: "E-mail já cadastrado" });
    }

    if (id) {
      const target = await db.user.findUnique({ where: { id } });
      if (!target) throw new UserError("Usuário não encontrado.");
      const staysAdmin = data.role === "ADMIN" && data.active;
      if (id === current.id && !staysAdmin) {
        throw new UserError("Você não pode desativar nem rebaixar o seu próprio usuário.");
      }
      if (target.role === "ADMIN" && target.active && !staysAdmin) {
        const others = await db.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
        if (others === 0) throw new UserError("É necessário manter ao menos um administrador ativo.");
      }
      await db.user.update({
        where: { id },
        data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
      });
    } else {
      await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password!, 12) } });
    }
    return { redirectTo: "/usuarios" };
  });
}
