"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { dateOnly } from "@/lib/dates";
import { ALLOWED_FILES, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, extensionOf, formatBytes } from "@/lib/contracts";
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
    const created = await db.contract.create({ data });
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
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new UserError("Selecione ao menos um arquivo.");
    if (files.length > MAX_FILES_PER_UPLOAD) {
      throw new UserError(`Envie até ${MAX_FILES_PER_UPLOAD} arquivos por vez.`);
    }
    const total = files.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_FILE_BYTES) {
      throw new UserError(`O envio ultrapassa ${formatBytes(MAX_FILE_BYTES)} (enviado: ${formatBytes(total)}). Envie menos arquivos por vez.`);
    }

    const prepared = [];
    for (const file of files) {
      const ext = extensionOf(file.name);
      const mimeType = ALLOWED_FILES[ext];
      if (!mimeType) {
        throw new UserError(
          `Tipo de arquivo não permitido: “${file.name}”. Aceitos: ${Object.keys(ALLOWED_FILES).join(", ")}.`,
        );
      }
      // nome sem caminho e sem caracteres de controle
      const fileName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(-150);
      prepared.push({ fileName, mimeType, sizeBytes: file.size, data: Buffer.from(await file.arrayBuffer()) });
    }

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
