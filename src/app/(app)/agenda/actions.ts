"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { addMinutes, dateOnly, localParts, zoned } from "@/lib/dates";
import { describeConflicts, findConflicts } from "@/lib/scheduling";
import { UserError, dateField, optional, parseForm, requiredEnum, selectId, timeField, type FormState } from "@/lib/form";

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

  return runAction(["AGENDA", "LANCAMENTOS"], formData, async () => {
    await db.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id },
        include: { patient: { select: { name: true } }, professional: { select: { name: true } } },
      });
      if (!appointment) throw new UserError("Atendimento não encontrado.");

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
        data: { status, canceledReason: status === "CANCELED" ? reason : null, canceledBy },
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

  return runAction(["AGENDA", "LANCAMENTOS"], formData, async () => {
    await db.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id },
        include: { patient: { select: { name: true } }, professional: { select: { name: true } } },
      });
      if (!appointment) throw new UserError("Atendimento não encontrado.");

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
