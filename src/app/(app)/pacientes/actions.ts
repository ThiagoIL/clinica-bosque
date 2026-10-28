"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { dateOnly } from "@/lib/dates";
import { readAnamnesisForm } from "@/lib/anamnesis";
import { extensionOf } from "@/lib/contracts";
import { prepareFiles } from "@/lib/uploads";
import {
  UserError, checkbox, cpf, digits, email, optional, optionalId, optionalDate, optionalEnum,
  optionalInteger, parseForm, required, selectId, type FormState,
} from "@/lib/form";

const SEX = ["FEMALE", "MALE", "OTHER"] as const;
const PAYMENT = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "BANK_SLIP", "TRANSFER", "HEALTH_INSURANCE", "OTHER"] as const;

// ───────────────────────── cadastro ─────────────────────────

const patientSchema = z.object({
  id: z.string().optional(),
  // dados do paciente
  name: required("Nome", 150),
  socialName: optional(150),
  cpf: cpf(),
  rg: optional(30),
  birthDate: optionalDate("Data de nascimento"),
  sex: optionalEnum(SEX),
  maritalStatus: optional(40),
  occupation: optional(100),
  naturalness: optional(100),
  education: optional(100),
  phone: digits(11),
  phone2: digits(11),
  email: email(),
  zipCode: digits(8),
  street: optional(150),
  number: optional(20),
  complement: optional(100),
  neighborhood: optional(100),
  city: optional(100),
  state: optional(2),
  // plano de saúde
  healthPlanId: optionalId(),
  healthInsuranceNumber: optional(60),
  // familiar / responsável
  guardianName: optional(150),
  guardianRelationship: optional(60),
  guardianCpf: cpf(),
  guardianPhone: digits(11),
  guardianEmail: email(),
  emergencyContactName: optional(150),
  emergencyContactRelationship: optional(60),
  emergencyContactPhone: digits(11),
  // observações
  observations: optional(5000),
  active: checkbox(),
});

/** Salva só os campos da aba Cadastro; anamnese e dados financeiros têm as suas próprias ações. */
export async function savePatient(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(patientSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, birthDate, active, healthPlanId, ...rest } = parsed.data;

  return runAction("PACIENTES", formData, async () => {
    // sem plano informado, o paciente é Particular
    const planId = healthPlanId ?? (await db.healthPlan.findFirst({ where: { isDefault: true } }))?.id ?? null;
    const data = { ...rest, healthPlanId: planId, birthDate: birthDate ? dateOnly(birthDate) : null };
    if (id) {
      await db.patient.update({ where: { id }, data: { ...data, active } });
      return { success: "Cadastro do paciente salvo." };
    }
    const created = await db.patient.create({ data });
    return { redirectTo: `/pacientes/${created.id}` };
  });
}

// ───────────────────────── anamnese ─────────────────────────

const idOnly = z.object({ id: selectId("o paciente") });

export async function savePatientAnamnesis(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idOnly, formData);
  if (parsed.state) return parsed.state;
  const { id } = parsed.data;

  return runAction("PACIENTES", formData, async () => {
    if (!(await db.patient.findUnique({ where: { id }, select: { id: true } }))) throw new UserError("Paciente não encontrado.");
    const { json, columns } = readAnamnesisForm(formData);
    await db.patient.update({ where: { id }, data: { ...columns, anamnesis: json } });
    return { success: "Anamnese salva." };
  });
}

// ───────────────────────── financeiro ─────────────────────────

const financialSchema = z.object({
  id: selectId("o paciente"),
  billingName: optional(150),
  billingCpf: cpf(),
  billingEmail: email(),
  billingPhone: digits(11),
  preferredPaymentMethod: optionalEnum(PAYMENT),
  defaultDueDay: optionalInteger("Dia de vencimento", 1, 28),
  financialNotes: optional(2000),
});

export async function savePatientFinancial(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(financialSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, ...data } = parsed.data;

  return runAction("PACIENTES", formData, async () => {
    await db.patient.update({ where: { id }, data });
    return { success: "Dados financeiros salvos." };
  });
}

// ───────────────────────── documentos ─────────────────────────

const uploadSchema = z.object({ patientId: selectId("o paciente") });

export async function uploadPatientFiles(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(uploadSchema, formData);
  if (parsed.state) return parsed.state;

  return runAction("PACIENTES", formData, async () => {
    const prepared = await prepareFiles(formData);
    if (prepared.length === 0) throw new UserError("Selecione ao menos um arquivo.");
    if (!(await db.patient.findUnique({ where: { id: parsed.data.patientId }, select: { id: true } }))) {
      throw new UserError("Paciente não encontrado.");
    }
    await db.patientFile.createMany({ data: prepared.map((p) => ({ ...p, patientId: parsed.data.patientId })) });
    return { success: `${prepared.length} documento(s) anexado(s).` };
  });
}

const fileIdSchema = z.object({ id: selectId("o documento") });

export async function deletePatientFile(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(fileIdSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction("PACIENTES", formData, async () => {
    await db.patientFile.delete({ where: { id: parsed.data.id } });
    return { success: "Documento removido." };
  });
}

// ───────────────────────── foto ─────────────────────────

const PHOTO_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

export async function savePatientPhoto(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idOnly, formData);
  if (parsed.state) return parsed.state;
  const { id } = parsed.data;

  return runAction("PACIENTES", formData, async () => {
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecione uma imagem.");
    const mimeType = PHOTO_TYPES[extensionOf(file.name)];
    if (!mimeType) throw new UserError("Use uma imagem JPG, PNG ou WEBP.");
    if (file.size > PHOTO_MAX_BYTES) throw new UserError("A foto deve ter até 3 MB.");
    if (!(await db.patient.findUnique({ where: { id }, select: { id: true } }))) throw new UserError("Paciente não encontrado.");

    const data = Buffer.from(await file.arrayBuffer());
    await db.patientPhoto.upsert({
      where: { patientId: id },
      create: { patientId: id, mimeType, data },
      update: { mimeType, data },
    });
    return { success: "Foto atualizada." };
  });
}

export async function removePatientPhoto(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idOnly, formData);
  if (parsed.state) return parsed.state;
  return runAction("PACIENTES", formData, async () => {
    await db.patientPhoto.deleteMany({ where: { patientId: parsed.data.id } });
    return { success: "Foto removida." };
  });
}

// ───────────────────────── exclusão ─────────────────────────

export async function deletePatient(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idOnly, formData);
  if (parsed.state) return parsed.state;
  return runAction("PACIENTES", formData, async () => {
    const id = parsed.data.id;
    const [appointments, engagements, entries] = await Promise.all([
      db.appointment.count({ where: { patientId: id } }),
      db.engagement.count({ where: { patientId: id } }),
      db.financialEntry.count({ where: { patientId: id } }),
    ]);
    if (appointments + engagements + entries > 0) {
      throw new UserError(
        "Este paciente possui atendimentos ou lançamentos financeiros e não pode ser excluído. Desative o cadastro em vez disso.",
      );
    }
    await db.patient.delete({ where: { id } });
    return { redirectTo: "/pacientes" };
  });
}
