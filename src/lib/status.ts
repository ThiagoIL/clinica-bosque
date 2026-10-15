import type { AppointmentStatus, EngagementStatus, EntryStatus } from "@/generated/prisma/enums";
import { todayString } from "@/lib/dates";

export type Tone = "gray" | "green" | "blue" | "amber" | "red" | "violet";

export const appointmentTone = (s: AppointmentStatus): Tone =>
  ({ SCHEDULED: "blue", CONFIRMED: "violet", COMPLETED: "green", CANCELED: "gray", NO_SHOW: "red" } as const)[s];

export const engagementTone = (s: EngagementStatus): Tone =>
  ({ ACTIVE: "green", COMPLETED: "blue", CANCELED: "gray" } as const)[s];

/** Situação efetiva de uma conta: em aberto, vencida, paga ou cancelada. */
export function entryDisplayStatus(entry: { status: EntryStatus; dueDate: Date }): {
  key: "PENDING" | "OVERDUE" | "PAID" | "CANCELED";
  label: string;
  tone: Tone;
} {
  if (entry.status === "PAID") return { key: "PAID", label: "Pago", tone: "green" };
  if (entry.status === "CANCELED") return { key: "CANCELED", label: "Cancelado", tone: "gray" };
  if (entry.dueDate.toISOString().slice(0, 10) < todayString()) return { key: "OVERDUE", label: "Vencido", tone: "red" };
  return { key: "PENDING", label: "Em aberto", tone: "amber" };
}
