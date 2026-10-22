"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import {
  MAX_OCCURRENCES, addMinutes, addMonths, dateOnly, endOfMonth, isDateString, localParts, occurrenceDates, zoned,
} from "@/lib/dates";
import { splitCents } from "@/lib/money";
import { describeConflicts, findConflicts } from "@/lib/scheduling";
import {
  UserError, dateField, integer, money, optional, optionalDate, optionalMoney, parseForm,
  requiredEnum, selectId, timeField, type FormState,
} from "@/lib/form";

const createSchema = z.object({
  patientId: selectId("o paciente"),
  professionalId: selectId("o profissional"),
  serviceId: selectId("o serviço"),
  unitPrice: money("Valor unitário", { allowZero: true }),
  discount: optionalMoney(),
  recurrence: requiredEnum(["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"], "Repetição"),
  weekdays: z.string().optional(),
  repeatEnd: z.enum(["COUNT", "UNTIL_DATE", "UNTIL_MONTH"]).optional().default("COUNT"),
  quantity: z.string().optional(),
  untilDate: optionalDate("Data final"),
  untilMonth: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{4}-(0[1-9]|1[0-2])$/.test(v), "Mês inválido"),
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
  const parsed = parseForm(createSchema, formData);
  if (parsed.state) return parsed.state;
  const d = parsed.data;

  return runAction("LANCAMENTOS", formData, async () => {
    // ── datas das sessões ──
    const weekdays = [...new Set((d.weekdays ?? "").split(",").filter(Boolean).map(Number))].filter(
      (n) => Number.isInteger(n) && n >= 0 && n <= 6,
    );
    let until: string | null = null;
    let dates: string[];
    if (d.recurrence === "NONE") {
      dates = [d.startDate];
    } else if (d.repeatEnd === "COUNT") {
      const count = Number(d.quantity);
      if (!Number.isInteger(count) || count < 1 || count > MAX_OCCURRENCES) {
        throw new UserError(`Informe a quantidade de sessões (de 1 a ${MAX_OCCURRENCES}).`, { quantity: "Quantidade inválida" });
      }
      dates = occurrenceDates(d.startDate, d.recurrence, { count, weekdays });
    } else {
      until = d.repeatEnd === "UNTIL_DATE" ? d.untilDate : d.untilMonth ? endOfMonth(`${d.untilMonth}-01`) : null;
      if (!until || !isDateString(until)) {
        throw new UserError("Informe até quando as sessões se repetem.", {
          [d.repeatEnd === "UNTIL_DATE" ? "untilDate" : "untilMonth"]: "Obrigatório",
        });
      }
      if (until < d.startDate) {
        throw new UserError("O término deve ser depois da data da primeira sessão.", {
          [d.repeatEnd === "UNTIL_DATE" ? "untilDate" : "untilMonth"]: "Anterior ao início",
        });
      }
      dates = occurrenceDates(d.startDate, d.recurrence, { until, weekdays });
    }
    if (dates.length === 0) throw new UserError("Nenhuma sessão foi gerada com os dados informados.");
    if (dates.length >= MAX_OCCURRENCES && d.repeatEnd !== "COUNT") {
      throw new UserError(`O período gera sessões demais (máximo de ${MAX_OCCURRENCES} por lançamento). Reduza o período.`);
    }
    const quantity = dates.length;

    // ── valores ──
    const gross = quantity * d.unitPrice;
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
          healthPlanId: patient.healthPlanId,
          quantity,
          unitPriceCents: d.unitPrice,
          discountCents: discount,
          totalCents: total,
          recurrence: d.recurrence,
          weekdays: d.recurrence === "MONTHLY" || d.recurrence === "NONE" ? [] : weekdays,
          repeatEnd: d.recurrence === "NONE" ? "COUNT" : d.repeatEnd,
          untilDate: until ? dateOnly(until) : null,
          durationMinutes: d.durationMinutes,
          billingMode: d.billingMode,
          installments: d.billingMode === "INSTALLMENTS" ? d.installments : 1,
          firstDueDate: d.billingMode === "PER_SESSION" ? null : dateOnly(d.firstDueDate ?? d.startDate),
          notes: d.notes,
        },
      });

      const shares = splitCents(total, quantity);
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
                quantity > 1
                  ? `${service.name} — sessão ${i + 1}/${quantity} — ${patient.name}`
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
              description: `${service.name} — pacote de ${quantity} sessão(ões) — ${patient.name}`,
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

// ───────────────────────── edição ─────────────────────────

const updateSchema = z.object({
  id: selectId("o lançamento"),
  professionalId: selectId("o profissional"),
  serviceId: selectId("o serviço"),
  unitPrice: optionalMoney(),
  discount: optionalMoney(),
  notes: optional(1000),
});

/**
 * Edita um lançamento. Profissional e serviço valem para os atendimentos futuros em aberto
 * (com nova checagem de conflito). Valor e desconto são recalculados nas cobranças por sessão
 * ainda não pagas; cobranças já pagas nunca são alteradas.
 */
export async function updateEngagement(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(updateSchema, formData);
  if (parsed.state) return parsed.state;
  const d = parsed.data;

  return runAction("LANCAMENTOS", formData, async () => {
    await db.$transaction(async (tx) => {
      const e = await tx.engagement.findUnique({
        where: { id: d.id },
        include: {
          appointments: true,
          entries: true,
          patient: { select: { name: true } },
          service: { select: { name: true } },
        },
      });
      if (!e) throw new UserError("Lançamento não encontrado.");
      if (e.status === "CANCELED") throw new UserError("Lançamento cancelado não pode ser editado.");

      const [professional, service] = await Promise.all([
        tx.professional.findUnique({ where: { id: d.professionalId } }),
        tx.service.findUnique({ where: { id: d.serviceId } }),
      ]);
      if (!professional || !service) throw new UserError("Profissional ou serviço não encontrado.");

      const now = new Date();
      const future = e.appointments.filter((a) => a.startsAt >= now && (a.status === "SCHEDULED" || a.status === "CONFIRMED"));
      const futureIds = future.map((a) => a.id);

      if (professional.id !== e.professionalId && future.length > 0) {
        const conflicts = await findConflicts(tx, {
          professionalId: professional.id,
          patientId: e.patientId,
          slots: future.map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
          excludeAppointmentIds: futureIds,
        });
        if (conflicts.length) {
          throw new UserError(describeConflicts(conflicts, { professional: professional.name, patient: e.patient.name }));
        }
        await tx.appointment.updateMany({ where: { id: { in: futureIds } }, data: { professionalId: professional.id } });
      }

      if (service.id !== e.serviceId) {
        await tx.appointment.updateMany({ where: { id: { in: futureIds } }, data: { serviceId: service.id } });
        for (const entry of e.entries.filter((x) => x.status === "PENDING")) {
          await tx.financialEntry.update({
            where: { id: entry.id },
            data: { description: entry.description.replace(e.service.name, service.name) },
          });
        }
      }

      let priceData = {};
      const unit = d.unitPrice ?? e.unitPriceCents;
      const discount = d.discount ?? 0;
      // Em cobrança única/parcelada os valores são ajustados direto em Contas a receber.
      const priceChanged = e.billingMode === "PER_SESSION" && (unit !== e.unitPriceCents || discount !== e.discountCents);
      if (priceChanged) {
        const gross = e.quantity * unit;
        if (discount > gross) throw new UserError("O desconto não pode ser maior que o valor total.", { discount: "Maior que o total" });
        const total = gross - discount;
        const shares = splitCents(total, e.quantity);
        for (const a of e.appointments) {
          if (a.status === "CANCELED" || !a.sequence) continue;
          const entry = e.entries.find((x) => x.appointmentId === a.id);
          if (entry && entry.status !== "PENDING") continue; // já pago: não mexe
          await tx.appointment.update({ where: { id: a.id }, data: { priceCents: shares[a.sequence - 1] } });
          if (entry) await tx.financialEntry.update({ where: { id: entry.id }, data: { amountCents: shares[a.sequence - 1] } });
        }
        priceData = { unitPriceCents: unit, discountCents: discount, totalCents: total };
      }

      await tx.engagement.update({
        where: { id: e.id },
        data: { professionalId: professional.id, serviceId: service.id, notes: d.notes, ...priceData },
      });
    });
    return { redirectTo: `/lancamentos/${d.id}` };
  });
}

const idSchema = z.object({ id: selectId("o lançamento") });

/** Cancela o lançamento: atendimentos futuros em aberto e cobranças pendentes são cancelados. */
export async function cancelEngagement(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction("LANCAMENTOS", formData, async () => {
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
