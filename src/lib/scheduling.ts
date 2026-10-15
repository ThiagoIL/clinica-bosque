import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/dates";

export type Slot = { startsAt: Date; endsAt: Date };

type Db = Prisma.TransactionClient;

export type Conflict = {
  slot: Slot;
  who: "professional" | "patient";
  withName: string;
};

/**
 * Procura atendimentos (não cancelados) que se sobrepõem aos horários informados,
 * para o mesmo profissional ou para o mesmo paciente.
 */
export async function findConflicts(
  db: Db,
  args: { professionalId: string; patientId: string; slots: Slot[]; excludeAppointmentIds?: string[] },
): Promise<Conflict[]> {
  const { professionalId, patientId, slots, excludeAppointmentIds = [] } = args;
  if (slots.length === 0) return [];

  const existing = await db.appointment.findMany({
    where: {
      status: { not: "CANCELED" },
      ...(excludeAppointmentIds.length ? { id: { notIn: excludeAppointmentIds } } : {}),
      AND: [
        { OR: [{ professionalId }, { patientId }] },
        { OR: slots.map((s) => ({ startsAt: { lt: s.endsAt }, endsAt: { gt: s.startsAt } })) },
      ],
    },
    include: { patient: { select: { name: true } }, professional: { select: { name: true } } },
  });

  const conflicts: Conflict[] = [];
  for (const slot of slots) {
    for (const a of existing) {
      if (a.startsAt < slot.endsAt && a.endsAt > slot.startsAt) {
        if (a.professionalId === professionalId) {
          conflicts.push({ slot, who: "professional", withName: a.patient.name });
        }
        if (a.patientId === patientId) {
          conflicts.push({ slot, who: "patient", withName: a.professional.name });
        }
      }
    }
  }
  return conflicts;
}

export function describeConflicts(conflicts: Conflict[], names: { professional: string; patient: string }): string {
  const lines = conflicts.slice(0, 5).map((c) =>
    c.who === "professional"
      ? `${formatDateTime(c.slot.startsAt)} — ${names.professional} já está agendado(a) com ${c.withName}`
      : `${formatDateTime(c.slot.startsAt)} — ${names.patient} já tem atendimento com ${c.withName}`,
  );
  const more = conflicts.length > 5 ? ` (+${conflicts.length - 5} conflitos)` : "";
  return `Conflito de horário: ${lines.join("; ")}${more}.`;
}
