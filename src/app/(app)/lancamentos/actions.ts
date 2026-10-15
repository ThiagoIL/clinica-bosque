"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { addMinutes, addMonths, dateOnly, localParts, occurrenceDates, zoned } from "@/lib/dates";
import { splitCents } from "@/lib/money";
import { describeConflicts, findConflicts } from "@/lib/scheduling";
import {
  UserError, dateField, integer, money, optional, optionalDate, optionalMoney, parseForm,
  requiredEnum, selectId, timeField, type FormState,
} from "@/lib/form";

const schema = z.object({
  patientId: selectId("o paciente"),
  professionalId: selectId("o profissional"),
  serviceId: selectId("o serviço"),
  quantity: integer("Quantidade", 1, 200),
  unitPrice: money("Valor unitário", { allowZero: true }),
  discount: optionalMoney(),
  recurrence: requiredEnum(["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"], "Recorrência"),
  startDate: dateField("Data"),
  startTime: timeField("Horário"),
  durationMinutes: integer("Duração", 5, 600),
  billingMode: requiredEnum(["PER_SESSION", "SINGLE", "INSTALLMENTS"], "Cobrança"),
  installments: z
    .string()
    .optional()
    .transform((v) => Math.min(60, Math.max(1, Number(v) || 1))),
  firstDueDate: optionalDate("Primeiro vencimento"),
  notes: optional(1000),
});

export async function createEngagement(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const d = parsed.data;

  return runAction(formData, async () => {
    if (d.recurrence === "NONE" && d.quantity > 1) {
      throw new UserError("Para lançar mais de uma sessão, escolha uma recorrência (diária, semanal, quinzenal ou mensal).", {
        quantity: "Use recorrência para mais de 1 sessão",
      });
    }
    const gross = d.quantity * d.unitPrice;
    const discount = d.discount ?? 0;
    if (discount > gross) {
      throw new UserError("O desconto não pode ser maior que o valor total.", { discount: "Maior que o total" });
    }
    const total = gross - discount;

    const [patient, professional, service] = await Promise.all([
      db.patient.findUnique({ where: { id: d.patientId } }),
      db.professional.findUnique({ where: { id: d.professionalId } }),
      db.service.findUnique({ where: { id: d.serviceId } }),
    ]);
    if (!patient || !professional || !service) throw new UserError("Paciente, profissional ou serviço não encontrado.");
    if (!patient.active) throw new UserError("Este paciente está inativo.", { patientId: "Paciente inativo" });
    if (!professional.active) throw new UserError("Este profissional está inativo.", { professionalId: "Profissional inativo" });

    const dates = occurrenceDates(d.startDate, d.recurrence, d.quantity);
    const slots = dates.map((date) => {
      const startsAt = zoned(date, d.startTime);
      return { date, startsAt, endsAt: addMinutes(startsAt, d.durationMinutes) };
    });

    const engagementId = await db.$transaction(async (tx) => {
      const conflicts = await findConflicts(tx, {
        professionalId: professional.id,
        patientId: patient.id,
        slots,
      });
      if (conflicts.length > 0) {
        throw new UserError(describeConflicts(conflicts, { professional: professional.name, patient: patient.name }));
      }

      const engagement = await tx.engagement.create({
        data: {
          patientId: patient.id,
          professionalId: professional.id,
          serviceId: service.id,
          quantity: d.quantity,
          unitPriceCents: d.unitPrice,
          discountCents: discount,
          totalCents: total,
          recurrence: d.recurrence,
          durationMinutes: d.durationMinutes,
          billingMode: d.billingMode,
          installments: d.billingMode === "INSTALLMENTS" ? d.installments : 1,
          firstDueDate: d.billingMode === "PER_SESSION" ? null : dateOnly(d.firstDueDate ?? d.startDate),
          notes: d.notes,
        },
      });

      const shares = splitCents(total, d.quantity);
      const appointments = await tx.appointment.createManyAndReturn({
        data: slots.map((s, i) => ({
          engagementId: engagement.id,
          sequence: i + 1,
          patientId: patient.id,
          professionalId: professional.id,
          serviceId: service.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          priceCents: shares[i],
        })),
        select: { id: true, sequence: true, startsAt: true },
      });
      appointments.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

      if (total > 0) {
        const category = await tx.financialCategory.findFirst({ where: { name: "Atendimentos", kind: "INCOME" } });
        const common = {
          kind: "INCOME" as const,
          patientId: patient.id,
          engagementId: engagement.id,
          categoryId: category?.id ?? null,
        };

        if (d.billingMode === "PER_SESSION") {
          await tx.financialEntry.createMany({
            data: appointments.map((a, i) => ({
              ...common,
              description:
                d.quantity > 1
                  ? `${service.name} — sessão ${i + 1}/${d.quantity} — ${patient.name}`
                  : `${service.name} — ${patient.name}`,
              amountCents: shares[i],
              dueDate: dateOnly(localParts(a.startsAt).date),
              appointmentId: a.id,
            })),
          });
        } else if (d.billingMode === "SINGLE") {
          await tx.financialEntry.create({
            data: {
              ...common,
              description: `${service.name} — pacote de ${d.quantity} sessão(ões) — ${patient.name}`,
              amountCents: total,
              dueDate: dateOnly(d.firstDueDate ?? d.startDate),
            },
          });
        } else {
          const parts = splitCents(total, d.installments);
          const first = d.firstDueDate ?? d.startDate;
          await tx.financialEntry.createMany({
            data: parts.map((amountCents, i) => ({
              ...common,
              description: `${service.name} — ${patient.name} (${i + 1}/${d.installments})`,
              amountCents,
              dueDate: dateOnly(addMonths(first, i)),
              installmentNumber: i + 1,
              installmentTotal: d.installments,
            })),
          });
        }
      }
      return engagement.id;
    });

    return { redirectTo: `/lancamentos/${engagementId}` };
  });
}

const idSchema = z.object({ id: selectId("o lançamento") });

/** Cancela o lançamento: atendimentos futuros em aberto e cobranças pendentes são cancelados. */
export async function cancelEngagement(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction(formData, async () => {
    const id = parsed.data.id;
    await db.$transaction(async (tx) => {
      await tx.engagement.update({ where: { id }, data: { status: "CANCELED" } });
      await tx.appointment.updateMany({
        where: { engagementId: id, status: { in: ["SCHEDULED", "CONFIRMED"] }, startsAt: { gte: new Date() } },
        data: { status: "CANCELED", canceledReason: "Lançamento cancelado" },
      });
      await tx.financialEntry.updateMany({
        where: { engagementId: id, status: "PENDING" },
        data: { status: "CANCELED" },
      });
    });
    return { success: "Lançamento cancelado." };
  });
}
