import type { AppointmentStatus } from "@/generated/prisma/enums";
import { ActionForm, ConfirmSubmit, SubmitButton, TextField } from "@/components/ui/form-kit";
import { localParts } from "@/lib/dates";
import { rescheduleAppointment, setAppointmentStatus } from "@/app/(app)/agenda/actions";

/**
 * Ações de um atendimento: informar a situação (agendamento confirmado, paciente presente ou ausente,
 * paciente ou profissional cancelou) e reagendar.
 */
export function AppointmentActions({
  appointment,
}: {
  appointment: { id: string; status: AppointmentStatus; startsAt: Date };
}) {
  const { date, time } = localParts(appointment.startsAt);
  const s = appointment.status;
  const canceled = s === "CANCELED";
  return (
    <div className="space-y-4">
      <ActionForm action={setAppointmentStatus} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={appointment.id} />
        {s !== "CONFIRMED" && s !== "COMPLETED" && !canceled && (
          <SubmitButton name="status" value="CONFIRMED" variant="outline" size="sm">Confirmar agendamento</SubmitButton>
        )}
        {s !== "COMPLETED" && <SubmitButton name="status" value="COMPLETED" size="sm">Paciente presente</SubmitButton>}
        {s !== "NO_SHOW" && <SubmitButton name="status" value="NO_SHOW" variant="outline" size="sm">Paciente ausente</SubmitButton>}
        {s !== "SCHEDULED" && (
          <SubmitButton name="status" value="SCHEDULED" variant="outline" size="sm">
            {canceled ? "Reativar" : "Voltar para agendado"}
          </SubmitButton>
        )}
        {!canceled && (
          <>
            <ConfirmSubmit name="status" value="CANCELED_PATIENT" message="Registrar que o paciente cancelou? A cobrança pendente dele também será cancelada.">
              Paciente cancelou
            </ConfirmSubmit>
            <ConfirmSubmit name="status" value="CANCELED_PROFESSIONAL" message="Registrar que o profissional cancelou? A cobrança pendente dele também será cancelada.">
              Profissional cancelou
            </ConfirmSubmit>
          </>
        )}
      </ActionForm>

      {!canceled && (
        <ActionForm action={rescheduleAppointment} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <input type="hidden" name="id" value={appointment.id} />
          <div className="w-40">
            <TextField name="date" label="Nova data" type="date" defaultValue={date} />
          </div>
          <div className="w-32">
            <TextField name="time" label="Novo horário" type="time" defaultValue={time} />
          </div>
          <SubmitButton variant="outline">Reagendar</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
