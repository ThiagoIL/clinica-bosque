"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { dateOnly } from "@/lib/dates";
import { prepareFiles } from "@/lib/uploads";
import { UserError, dateField, optional, optionalDate, optionalMoney, parseForm, required, selectId, type FormState } from "@/lib/form";

const contractSchema = z.object({
  id: z.string().optional(),
  collaboratorId: selectId("o colaborador"),
  title: required("Título", 150),
  code: optional(40),
  description: optional(2000),
  startDate: dateField("Início"),
  endDate: optionalDate("Fim"),
  value: optionalMoney(),
  valueNote: optional(80),
});

export async function saveContract(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(contractSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, value, startDate, endDate, ...rest } = parsed.data;

  return runAction("CONTRATOS", formData, async () => {
    if (endDate && endDate < startDate) {
      throw new UserError("A data final deve ser igual ou posterior ao início.", { endDate: "Anterior ao início" });
    }
    if (!(await db.collaborator.findUnique({ where: { id: rest.collaboratorId } }))) {
      throw new UserError("Colaborador não encontrado.");
    }
    const data = { ...rest, valueCents: value, startDate: dateOnly(startDate), endDate: endDate ? dateOnly(endDate) : null };
    if (id) {
      await db.contract.update({ where: { id }, data });
      return { success: "Contrato salvo." };
    }
    // anexos opcionais na criação: valida tudo antes de gravar o contrato
    const files = await prepareFiles(formData);
    const created = await db.contract.create({ data: { ...data, files: { create: files } } });
    return { redirectTo: `/contratos/${created.id}` };
  });
}

const endSchema = z.object({
  id: selectId("o contrato"),
  endedOn: dateField("Data de encerramento"),
  reason: optional(300),
});

export async function endContract(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(endSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, endedOn, reason } = parsed.data;
  return runAction("CONTRATOS", formData, async () => {
    await db.contract.update({
      where: { id },
      data: { status: "ENDED", endedOn: dateOnly(endedOn), endReason: reason },
    });
    return { success: "Contrato encerrado." };
  });
}

const idSchema = z.object({ id: selectId("o registro") });

export async function reopenContract(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction("CONTRATOS", formData, async () => {
    await db.contract.update({ where: { id: parsed.data.id }, data: { status: "ACTIVE", endedOn: null, endReason: null } });
    return { success: "Contrato reativado." };
  });
}

// ───────────────────────── anexos ─────────────────────────

const uploadSchema = z.object({ contractId: selectId("o contrato") });

export async function uploadContractFiles(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(uploadSchema, formData);
  if (parsed.state) return parsed.state;

  return runAction("CONTRATOS", formData, async () => {
    const prepared = await prepareFiles(formData);
    if (prepared.length === 0) throw new UserError("Selecione ao menos um arquivo.");

    const contract = await db.contract.findUnique({ where: { id: parsed.data.contractId }, select: { id: true } });
    if (!contract) throw new UserError("Contrato não encontrado.");

    await db.contractFile.createMany({ data: prepared.map((p) => ({ ...p, contractId: contract.id })) });
    return { success: `${prepared.length} arquivo(s) anexado(s).` };
  });
}

export async function deleteContractFile(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction("CONTRATOS", formData, async () => {
    await db.contractFile.delete({ where: { id: parsed.data.id } });
    return { success: "Anexo removido." };
  });
}
