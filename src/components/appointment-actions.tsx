import type { AppointmentStatus } from "@/generated/prisma/enums";
import { ActionForm, ConfirmSubmit, SubmitButton, TextField } from "@/components/ui/form-kit";
import { localParts } from "@/lib/dates";
import { rescheduleAppointment, setAppointmentStatus } from "@/app/(app)/agenda/actions";

/** Ações de um atendimento: situação (confirmar, realizado, faltou, cancelar) e reagendamento. */
export function AppointmentActions({
  appointment,
}: {
  appointment: { id: string; status: AppointmentStatus; startsAt: Date };
}) {
  const { date, time } = localParts(appointment.startsAt);
  const s = appointment.status;
  return (
    <div className="space-y-4">
      <ActionForm action={setAppointmentStatus} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={appointment.id} />
        {s === "SCHEDULED" && <SubmitButton name="status" value="CONFIRMED" variant="outline" size="sm">Confirmar presença</SubmitButton>}
        {(s === "SCHEDULED" || s === "CONFIRMED") && (
          <>
            <SubmitButton name="status" value="COMPLETED" size="sm">Marcar como realizado</SubmitButton>
            <SubmitButton name="status" value="NO_SHOW" variant="outline" size="sm">Faltou</SubmitButton>
          </>
        )}
        {(s === "COMPLETED" || s === "NO_SHOW" || s === "CONFIRMED") && (
          <SubmitButton name="status" value="SCHEDULED" variant="outline" size="sm">Voltar para agendado</SubmitButton>
        )}
        {s === "CANCELED" && <SubmitButton name="status" value="SCHEDULED" variant="outline" size="sm">Reativar</SubmitButton>}
        {s !== "CANCELED" && (
          <ConfirmSubmit name="status" value="CANCELED" message="Cancelar este atendimento? A cobrança pendente dele também será cancelada.">
            Cancelar atendimento
          </ConfirmSubmit>
        )}
      </ActionForm>

      {s !== "CANCELED" && (
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
