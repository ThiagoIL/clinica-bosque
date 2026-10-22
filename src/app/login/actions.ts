"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { loadSnapshot } from "@/lib/access";
import { parseForm, formValues, type FormState } from "@/lib/form";

// Limitador simples em memória (instância única): 5 falhas / 15 min por e-mail + IP.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Hash fictício para igualar o tempo de resposta quando o e-mail não existe.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("senha-inexistente", 12));

const schema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Informe o e-mail"),
  password: z.string().min(1, "Informe a senha"),
  next: z.string().optional(),
});

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  if ((await loadSnapshot(null)).blocked) redirect("/bloqueado");
  const parsed = parseForm(schema, formData);
  if (parsed.state) return { ...parsed.state, values: { email: formValues(formData).email ?? "" } };
  const { email, password, next } = parsed.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${email}|${ip}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && now - entry.first > WINDOW_MS) attempts.delete(key);
  const current = attempts.get(key);
  if (current && current.count >= MAX_ATTEMPTS) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.", values: { email } };
  }

  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !user.active || !valid) {
    const count = (attempts.get(key)?.count ?? 0) + 1;
    attempts.set(key, { count, first: attempts.get(key)?.first ?? now });
    return { error: "E-mail ou senha incorretos.", values: { email } };
  }

  attempts.delete(key);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
