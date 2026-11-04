"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import {
  UserError, checkbox, digits, email, optional, optionalDate, optionalId, parseForm, required,
  type FormState,
} from "@/lib/form";
import { isValidCpf } from "@/lib/cpf";
import { dateOnly } from "@/lib/dates";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 150),
  specialtyId: optionalId(),
  role: optional(100),
  registryType: optional(20),
  registryNumber: optional(40),
  // CPF (pessoa) ou CNPJ (empresa)
  cpf: digits(14).refine((v) => v === null || v.length === 14 || (v.length === 11 && isValidCpf(v)), "CPF ou CNPJ inválido"),
  birthDate: optionalDate("Data de nascimento"),
  phone: digits(11),
  email: email(),
  notes: optional(2000),
  attends: checkbox(),
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
    if (id && !rest.attends) {
      // quem deixa de atender não pode ter atendimentos futuros em aberto
      const open = await db.appointment.count({
        where: { professionalId: id, startsAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      });
      if (open > 0) {
        throw new UserError(
          `Há ${open} atendimento(s) futuro(s) deste profissional. Cancele ou transfira antes de desmarcar “Atende pacientes”.`,
          { attends: "Há atendimentos futuros" },
        );
      }
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
    const [engagements, appointments, contracts, entries, movements] = await Promise.all([
      db.engagement.count({ where: { professionalId: id } }),
      db.appointment.count({ where: { professionalId: id } }),
      db.contract.count({ where: { professionalId: id } }),
      db.financialEntry.count({ where: { professionalId: id } }),
      db.stockMovement.count({ where: { professionalId: id } }),
    ]);
    if (engagements + appointments > 0) {
      throw new UserError(
        `Este profissional possui ${engagements} lançamento(s) e ${appointments} atendimento(s) e não pode ser excluído. Desative o cadastro em vez disso.`,
      );
    }
    if (contracts + entries + movements > 0) {
      throw new UserError(
        `Este cadastro tem ${contracts} contrato(s), ${entries} conta(s) a pagar e ${movements} movimentação(ões) de estoque e não pode ser excluído. Desative-o em vez disso.`,
      );
    }
    if (await db.user.findUnique({ where: { professionalId: id } })) {
      throw new UserError("Este profissional está vinculado a um usuário. Desfaça o vínculo em Usuários antes de excluir.");
    }
    await db.professional.delete({ where: { id } });
    return { redirectTo: "/profissionais" };
  });
}
