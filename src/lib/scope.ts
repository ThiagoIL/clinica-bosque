import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { UserError } from "@/lib/form";

/**
 * Profissional ao qual o usuário fica restrito: quem não é administrador e está ligado a um profissional
 * só vê e mexe nos próprios atendimentos e lançamentos. Administradores e usuários sem vínculo veem tudo (null).
 */
export const ownProfessionalId = cache(async (userId: string): Promise<string | null> => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, professionalId: true } });
  return user && user.role !== "ADMIN" ? user.professionalId : null;
});

/** Barra a ação quando o registro é de outro profissional e o usuário está restrito aos próprios. */
export async function assertOwnProfessional(userId: string, professionalId: string) {
  const own = await ownProfessionalId(userId);
  if (own && own !== professionalId) {
    throw new UserError("Você só pode mexer nos seus próprios atendimentos e lançamentos.");
  }
}
