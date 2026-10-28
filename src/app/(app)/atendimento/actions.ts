"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, parseForm, required, selectId, type FormState } from "@/lib/form";

const evolutionSchema = z.object({
  appointmentId: selectId("o atendimento"),
  content: required("Evolução", 20000),
});

/** Registra (ou atualiza) a evolução de um atendimento. Só o profissional do atendimento ou o administrador. */
export async function saveEvolution(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(evolutionSchema, formData);
  if (parsed.state) return parsed.state;
  const { appointmentId, content } = parsed.data;

  return runAction("AGENDA", formData, async (user) => {
    const [appointment, me] = await Promise.all([
      db.appointment.findUnique({ where: { id: appointmentId }, select: { id: true, patientId: true, professionalId: true } }),
      db.user.findUnique({ where: { id: user.id }, select: { role: true, professionalId: true } }),
    ]);
    if (!appointment) throw new UserError("Atendimento não encontrado.");
    if (me?.role !== "ADMIN" && me?.professionalId !== appointment.professionalId) {
      throw new UserError("Somente o profissional do atendimento (ou o administrador) registra a evolução.");
    }
    await db.evolution.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
        authorId: user.id,
        content,
      },
      update: { content },
    });
    return { success: "Evolução salva." };
  });
}
