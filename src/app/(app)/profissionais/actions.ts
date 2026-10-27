"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import {
  UserError, checkbox, cpf, digits, email, hexColor, optional, optionalDate, optionalId, parseForm, required,
  type FormState,
} from "@/lib/form";
import { dateOnly } from "@/lib/dates";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 150),
  specialtyId: optionalId(),
  registryType: optional(20),
  registryNumber: optional(40),
  cpf: cpf(),
  birthDate: optionalDate("Data de nascimento"),
  phone: digits(11),
  email: email(),
  color: hexColor(),
  notes: optional(2000),
  active: checkbox(),
});

export async function saveProfessional(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, birthDate, ...rest } = parsed.data;
  return runAction("PROFISSIONAIS", formData, async () => {
    if (rest.specialtyId && !(await db.specialty.findUnique({ where: { id: rest.specialtyId } }))) {
      throw new UserError("Especialidade não encontrada.", { specialtyId: "Especialidade inválida" });
    }
    const data = { ...rest, birthDate: birthDate ? dateOnly(birthDate) : null };
    if (id) await db.professional.update({ where: { id }, data });
    else await db.professional.create({ data });
    return { redirectTo: "/profissionais" };
  });
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteProfessional(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  const { id } = parsed.data;

  return runAction("PROFISSIONAIS", formData, async () => {
    const [engagements, appointments] = await Promise.all([
      db.engagement.count({ where: { professionalId: id } }),
      db.appointment.count({ where: { professionalId: id } }),
    ]);
    if (engagements + appointments > 0) {
      throw new UserError(
        `Este profissional possui ${engagements} lançamento(s) e ${appointments} atendimento(s) e não pode ser excluído. Desative o cadastro em vez disso.`,
      );
    }
    await db.professional.delete({ where: { id } });
    return { redirectTo: "/profissionais" };
  });
}
