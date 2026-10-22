import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { PLATFORM_BASE_HEADER } from "@/lib/platform-config";

export const PLATFORM_COOKIE = "bosque_platform";
const TTL_SECONDS = 60 * 60 * 8; // 8 horas

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET precisa ter ao menos 32 caracteres");
  return new TextEncoder().encode(value);
}

/**
 * Prefixo do console na requisição atual: "" (domínio dedicado) ou ex.: "/sistema-admin".
 * Vem de um header que o proxy sempre define; valores estranhos são descartados.
 */
export async function getPlatformBase(): Promise<string> {
  const value = (await headers()).get(PLATFORM_BASE_HEADER) ?? "";
  return /^\/[A-Za-z0-9/_-]*$/.test(value) && !value.startsWith("//") ? value : "";
}

export async function createPlatformSession(adminId: string) {
  const base = await getPlatformBase();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setAudience("platform")
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // no modo por caminho, o cookie só é enviado ao console (nunca às telas da clínica)
    path: base || "/",
    maxAge: TTL_SECONDS,
  });
}

export async function destroyPlatformSession() {
  const base = await getPlatformBase();
  (await cookies()).delete({ name: PLATFORM_COOKIE, path: base || "/" });
}

export const getPlatformAdmin = cache(async () => {
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "platform" });
    if (!payload.sub) return null;
    const admin = await db.platformAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, active: true },
    });
    return admin?.active ? admin : null;
  } catch {
    return null;
  }
});

export async function requirePlatformAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect(`${await getPlatformBase()}/login`);
  return admin;
}
