"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { dateOnly } from "@/lib/dates";
import {
  UserError, checkbox, cpf, digits, email, optional, optionalDate, optionalEnum,
  optionalInteger, parseForm, required, type FormState,
} from "@/lib/form";

const SEX = ["FEMALE", "MALE", "OTHER"] as const;
const PAYMENT = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "BANK_SLIP", "TRANSFER", "HEALTH_INSURANCE", "OTHER"] as const;

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
  // familiar
  guardianName: optional(150),
  guardianRelationship: optional(60),
  guardianCpf: cpf(),
  guardianPhone: digits(11),
  guardianEmail: email(),
  emergencyContactName: optional(150),
  emergencyContactRelationship: optional(60),
  emergencyContactPhone: digits(11),
  // saúde
  healthInsurance: optional(100),
  healthInsuranceNumber: optional(60),
  bloodType: optional(5),
  allergies: optional(2000),
  medications: optional(2000),
  chronicConditions: optional(2000),
  surgeries: optional(2000),
  diagnosis: optional(2000),
  healthNotes: optional(4000),
  // financeiro
  billingName: optional(150),
  billingCpf: cpf(),
  billingEmail: email(),
  billingPhone: digits(11),
  preferredPaymentMethod: optionalEnum(PAYMENT),
  defaultDueDay: optionalInteger("Dia de vencimento", 1, 28),
  financialNotes: optional(2000),
  // observações
  observations: optional(5000),
  active: checkbox(),
});

export async function savePatient(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(patientSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, birthDate, active, ...rest } = parsed.data;

  return runAction(formData, async () => {
    const data = { ...rest, birthDate: birthDate ? dateOnly(birthDate) : null };
    if (id) {
      await db.patient.update({ where: { id }, data: { ...data, active } });
      return { success: "Dados do paciente salvos." };
    }
    const created = await db.patient.create({ data });
    return { redirectTo: `/pacientes/${created.id}` };
  });
}

const noteSchema = z.object({
  patientId: z.string().min(1),
  content: required("Anotação", 4000),
});

export async function addPatientNote(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(noteSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction(formData, async (user) => {
    await db.patientNote.create({
      data: { patientId: parsed.data.patientId, content: parsed.data.content, authorId: user.id },
    });
    return { success: "Anotação registrada." };
  });
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deletePatientNote(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction(formData, async () => {
    await db.patientNote.delete({ where: { id: parsed.data.id } });
    return {};
  });
}

export async function deletePatient(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction(formData, async () => {
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
