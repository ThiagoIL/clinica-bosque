"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, checkbox, parseForm, required, type FormState } from "@/lib/form";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 100),
  active: checkbox(),
});

export async function saveSpecialty(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, name, active } = parsed.data;

  return runAction("CADASTROS", formData, async () => {
    const sameName = await db.specialty.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
    });
    if (sameName) throw new UserError("Já existe uma especialidade com este nome.", { name: "Nome já cadastrado" });

    if (id) await db.specialty.update({ where: { id }, data: { name, active } });
    else await db.specialty.create({ data: { name } });
    return { redirectTo: "/especialidades" };
  });
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteSpecialty(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  const { id } = parsed.data;

  return runAction("CADASTROS", formData, async () => {
    const professionals = await db.professional.count({ where: { specialtyId: id } });
    if (professionals > 0) {
      throw new UserError(
        `Esta especialidade está em ${professionals} profissional(is) e não pode ser excluída. Desative-a ou troque a especialidade deles.`,
      );
    }
    await db.specialty.delete({ where: { id } });
    return { success: "Especialidade excluída." };
  });
}
