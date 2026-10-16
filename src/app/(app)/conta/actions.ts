"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, parseForm, required, type FormState } from "@/lib/form";

const MIN_PASSWORD = 8;

const schema = z.object({
  name: required("Nome", 120),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
});

export async function updateAccount(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { name, currentPassword, newPassword, confirmPassword } = parsed.data;

  return runAction(formData, async (user) => {
    if (!newPassword) {
      await db.user.update({ where: { id: user.id }, data: { name } });
      return { success: "Dados atualizados." };
    }

    if (newPassword.length < MIN_PASSWORD) {
      throw new UserError(`A nova senha deve ter ao menos ${MIN_PASSWORD} caracteres.`, { newPassword: `Mínimo de ${MIN_PASSWORD} caracteres` });
    }
    if (newPassword !== confirmPassword) {
      throw new UserError("A confirmação não confere com a nova senha.", { confirmPassword: "Não confere" });
    }
    const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!currentPassword || !(await bcrypt.compare(currentPassword, record.passwordHash))) {
      throw new UserError("A senha atual está incorreta.", { currentPassword: "Senha atual incorreta" });
    }
    await db.user.update({ where: { id: user.id }, data: { name, passwordHash: await bcrypt.hash(newPassword, 12) } });
    return { success: "Senha alterada com sucesso." };
  });
}
