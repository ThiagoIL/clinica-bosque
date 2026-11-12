"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { addDays, addMinutes, dateOnly, localParts, weekday, zoned } from "@/lib/dates";
import { describeConflicts, findConflicts } from "@/lib/scheduling";
import { assertOwnProfessional } from "@/lib/scope";
import {
  UserError, dateField, integer, optional, parseForm, requiredEnum, selectId, timeField, type FormState,
} from "@/lib/form";

const statusSchema = z.object({
  id: selectId("o atendimento"),
  status: requiredEnum(
    ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELED", "CANCELED_PATIENT", "CANCELED_PROFESSIONAL", "NO_SHOW"],
    "Situação",
  ),
  reason: optional(300),
});

/** Status pedido na tela → status gravado e, no cancelamento, quem cancelou. */
function resolveStatus(requested: z.infer<typeof statusSchema>["status"]) {
  if (requested === "CANCELED_PATIENT") return { status: "CANCELED" as const, canceledBy: "PATIENT" as const };
  if (requested === "CANCELED_PROFESSIONAL") return { status: "CANCELED" as const, canceledBy: "PROFESSIONAL" as const };
  return { status: requested, canceledBy: null };
}

export async function setAppointmentStatus(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(statusSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, reason } = parsed.data;
  const { status, canceledBy } = resolveStatus(parsed.data.status);

  return runAction(["AGENDA", "LANCAMENTOS"], formData, async (user) => {
    await db.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id },
        include: { patient: { select: { name: true } }, professional: { select: { name: true } } },
      });
      if (!appointment) throw new UserError("Atendimento não encontrado.");
      await assertOwnProfessional(user.id, appointment.professionalId);

      // Reabrir um atendimento cancelado volta a ocupar o horário: revalida conflitos.
      if (appointment.status === "CANCELED" && status !== "CANCELED") {
        const conflicts = await findConflicts(tx, {
          professionalId: appointment.professionalId,
          patientId: appointment.patientId,
          slots: [{ startsAt: appointment.startsAt, endsAt: appointment.endsAt }],
          excludeAppointmentIds: [id],
        });
        if (conflicts.length) {
          throw new UserError(
            describeConflicts(conflicts, { professional: appointment.professional.name, patient: appointment.patient.name }),
          );
        }
      }

      await tx.appointment.update({
        where: { id },
        data: {
          status,
          canceledReason: status === "CANCELED" ? reason : null,
          canceledBy,
          statusChangedById: user.id,
          statusChangedAt: new Date(),
        },
      });

      // Cobrança por sessão acompanha o cancelamento / reabertura do atendimento.
      if (status === "CANCELED") {
        await tx.financialEntry.updateMany({
          where: { appointmentId: id, status: "PENDING" },
          data: { status: "CANCELED" },
        });
      } else if (appointment.status === "CANCELED") {
        await tx.financialEntry.updateMany({
          where: { appointmentId: id, status: "CANCELED" },
          data: { status: "PENDING" },
        });
      }
    });
    return { success: "Atendimento atualizado." };
  });
}

const rescheduleSchema = z.object({
  id: selectId("o atendimento"),
  date: dateField("Data"),
  time: timeField("Horário"),
});

export async function rescheduleAppointment(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(rescheduleSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, date, time } = parsed.data;

  return runAction(["AGENDA", "LANCAMENTOS"], formData, async (user) => {
    await db.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id },
        include: { patient: { select: { name: true } }, professional: { select: { name: true } } },
      });
      if (!appointment) throw new UserError("Atendimento não encontrado.");
      await assertOwnProfessional(user.id, appointment.professionalId);

      const duration = Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60_000);
      const startsAt = zoned(date, time);
      const endsAt = addMinutes(startsAt, duration);

      if (appointment.status !== "CANCELED") {
        const conflicts = await findConflicts(tx, {
          professionalId: appointment.professionalId,
          patientId: appointment.patientId,
          slots: [{ startsAt, endsAt }],
          excludeAppointmentIds: [id],
        });
        if (conflicts.length) {
          throw new UserError(
            describeConflicts(conflicts, { professional: appointment.professional.name, patient: appointment.patient.name }),
          );
        }
      }

      await tx.appointment.update({ where: { id }, data: { startsAt, endsAt } });
      await tx.financialEntry.updateMany({
        where: { appointmentId: id, status: "PENDING" },
        data: { dueDate: dateOnly(localParts(startsAt).date) },
      });
    });
    return { success: "Atendimento reagendado." };
  });
}

// ───────────────────────── arrastar / redimensionar na agenda ─────────────────────────

const moveSchema = z.object({
  id: selectId("o atendimento"),
  date: dateField("Data"),
  time: timeField("Horário"),
  duration: integer("Duração", 5, 600),
  /** "one": só este atendimento; "series": este e os próximos do mesmo lançamento. */
  scope: z.enum(["one", "series"]).optional().default("one"),
});

/**
 * Move e/ou muda a duração de um atendimento (arrastar e esticar na agenda).
 * Com `scope = series`, vale para este e os próximos atendimentos em aberto do mesmo lançamento:
 * a duração muda em todos; o novo dia e horário valem para os que caem no mesmo dia da semana do atendimento
 * arrastado (os demais dias de uma repetição com vários dias da semana ficam como estão).
 */
export async function moveAppointment(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(moveSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, date, time, duration, scope } = parsed.data;

  return runAction(["AGENDA", "LANCAMENTOS"], formData, async (user) => {
    let count = 1;
    await db.$transaction(async (tx) => {
      const a = await tx.appointment.findUnique({
        where: { id },
        include: {
          patient: { select: { name: true } },
          professional: { select: { name: true } },
          engagement: { select: { id: true, weekdays: true } },
        },
      });
      if (!a) throw new UserError("Atendimento não encontrado.");
      await assertOwnProfessional(user.id, a.professionalId);
      if (a.status !== "SCHEDULED" && a.status !== "CONFIRMED") {
        throw new UserError("Só dá para mover ou esticar atendimentos agendados ou confirmados.");
      }

      const origDate = localParts(a.startsAt).date;
      const origTime = localParts(a.startsAt).time;
      const dayDelta = Math.round((dateOnly(date).getTime() - dateOnly(origDate).getTime()) / 86_400_000);
      const origWeekday = weekday(origDate);

      // quais atendimentos mudam
      const targets =
        scope === "series" && a.engagementId
          ? await tx.appointment.findMany({
              where: { engagementId: a.engagementId, status: { in: ["SCHEDULED", "CONFIRMED"] }, startsAt: { gte: a.startsAt } },
              orderBy: { startsAt: "asc" },
            })
          : [a];

      const moving = dayDelta !== 0 || time !== origTime;
      const changes = targets.map((t) => {
        const tDate = localParts(t.startsAt).date;
        const shifts = moving && (t.id === a.id || weekday(tDate) === origWeekday);
        const startsAt = shifts ? zoned(addDays(tDate, dayDelta), time) : t.startsAt;
        return { id: t.id, startsAt, endsAt: addMinutes(startsAt, duration), moved: shifts };
      });
      count = changes.length;

      const conflicts = await findConflicts(tx, {
        professionalId: a.professionalId,
        patientId: a.patientId,
        slots: changes.map((c) => ({ startsAt: c.startsAt, endsAt: c.endsAt })),
        excludeAppointmentIds: changes.map((c) => c.id),
      });
      if (conflicts.length) {
        throw new UserError(describeConflicts(conflicts, { professional: a.professional.name, patient: a.patient.name }));
      }

      // para a troca não esbarrar nos horários dos próprios atendimentos da série, atualiza na ordem certa
      const ordered = dayDelta > 0 ? [...changes].reverse() : changes;
      for (const c of ordered) {
        await tx.appointment.update({ where: { id: c.id }, data: { startsAt: c.startsAt, endsAt: c.endsAt } });
        if (c.moved) {
          await tx.financialEntry.updateMany({
            where: { appointmentId: c.id, status: "PENDING" },
            data: { dueDate: dateOnly(localParts(c.startsAt).date) },
          });
        }
      }

      if (scope === "series" && a.engagement) {
        const wd = a.engagement.weekdays;
        const newWd = wd.length > 0 && dayDelta !== 0 && a.sequence === 1
          ? [...new Set(wd.map((d) => (d === origWeekday ? weekday(date) : d)))].sort((x, y) => x - y)
          : wd;
        await tx.engagement.update({ where: { id: a.engagement.id }, data: { durationMinutes: duration, weekdays: newWd } });
      }
    });
    return { success: count > 1 ? `${count} atendimentos atualizados.` : "Atendimento atualizado." };
  });
}
