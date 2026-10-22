import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { loadSnapshot } from "@/lib/access";

export const SESSION_COOKIE = "bosque_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET precisa ter ao menos 32 caracteres");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Usuário logado (ou null). Cacheado por requisição. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    // sessões do console do fornecedor (aud "platform") nunca valem para a clínica
    if (payload.aud === "platform") return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    return user?.active ? user : null;
  } catch {
    return null;
  }
});

/** Usuário logado; sem sessão vai para o login e, com o sistema bloqueado, para a tela de bloqueio. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const snapshot = await loadSnapshot(user.id);
  if (snapshot.blocked) redirect("/bloqueado");
  return user;
}

/** Estado de acesso do usuário logado (módulos liberados e permissões). Cacheado por requisição. */
export const getAccess = cache(async () => {
  const user = await requireUser();
  return loadSnapshot(user.id);
});

/** Somente administradores; os demais voltam ao início. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
