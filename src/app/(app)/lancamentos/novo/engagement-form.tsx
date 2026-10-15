"use client";

import { useMemo, useState } from "react";
import { ActionForm, FormActions, FormGrid, SelectField, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import { formatDate, occurrenceDates, type RecurrenceKind } from "@/lib/dates";
import { billingModeLabels, optionsOf, recurrenceLabels } from "@/lib/labels";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";
import { createEngagement } from "../actions";

type Props = {
  patients: { id: string; name: string }[];
  professionals: { id: string; name: string }[];
  services: { id: string; name: string; priceCents: number; duration: number }[];
  defaults: { patientId?: string; professionalId?: string; date: string; time: string };
};

export function EngagementForm({ patients, professionals, services, defaults }: Props) {
  const [serviceId, setServiceId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [duration, setDuration] = useState("50");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceKind>("NONE");
  const [billingMode, setBillingMode] = useState("PER_SESSION");
  const [startDate, setStartDate] = useState(defaults.date);

  const onServiceChange = (id: string) => {
    setServiceId(id);
    const service = services.find((s) => s.id === id);
    if (service) {
      setUnitPrice(centsToInput(service.priceCents));
      setDuration(String(service.duration));
    }
  };

  const qty = Math.max(0, Math.min(200, Math.floor(Number(quantity) || 0)));
  const unit = parseMoney(unitPrice) ?? 0;
  const disc = parseMoney(discount) ?? 0;
  const total = Math.max(0, qty * unit - disc);

  const dates = useMemo(
    () => (qty > 0 && startDate ? occurrenceDates(startDate, recurrence, recurrence === "NONE" ? 1 : qty) : []),
    [qty, startDate, recurrence],
  );

  return (
    <ActionForm action={createEngagement} className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-4 text-sm">Atendimento</h2>
        <FormGrid>
          <SelectField
            name="patientId" label="Paciente" required defaultValue={defaults.patientId}
            options={patients.map((p) => ({ value: p.id, label: p.name }))}
          />
          <SelectField
            name="professionalId" label="Profissional" required defaultValue={defaults.professionalId}
            options={professionals.map((p) => ({ value: p.id, label: p.name }))}
          />
          <SelectField
            name="serviceId" label="Serviço (consulta / sessão / terapia)" required
            value={serviceId} onChange={onServiceChange}
            options={services.map((s) => ({ value: s.id, label: s.name }))}
          />
        </FormGrid>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm">Agenda</h2>
        <FormGrid cols={4}>
          <TextField name="startDate" label="Data da 1ª sessão" type="date" required value={startDate} onChange={setStartDate} />
          <TextField name="startTime" label="Horário" type="time" required defaultValue={defaults.time} />
          <TextField
            name="durationMinutes" label="Duração (min)" type="number" min={5} max={600} required
            value={duration} onChange={setDuration}
          />
          <SelectField
            name="recurrence" label="Repetição" required allowEmpty={false}
            options={optionsOf(recurrenceLabels)}
            value={recurrence} onChange={(v) => setRecurrence(v as RecurrenceKind)}
          />
          <TextField
            name="quantity" label="Quantidade de sessões" type="number" min={1} max={200} required
            value={quantity} onChange={setQuantity}
            hint={recurrence === "NONE" ? "Escolha uma repetição para lançar mais de uma sessão" : undefined}
          />
        </FormGrid>

        {dates.length > 0 && (
          <p className="mt-4 text-xs text-muted">
            Datas previstas ({dates.length}):{" "}
            <span className="text-ink">
              {dates.slice(0, 12).map(formatDate).join(" · ")}
              {dates.length > 12 ? ` … ${formatDate(dates[dates.length - 1])}` : ""}
            </span>
          </p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm">Valores e cobrança</h2>
        <FormGrid cols={4}>
          <TextField
            name="unitPrice" label="Valor por sessão (R$)" required inputMode="decimal"
            value={unitPrice} onChange={setUnitPrice}
          />
          <TextField name="discount" label="Desconto total (R$)" inputMode="decimal" value={discount} onChange={setDiscount} />
          <div className="flex flex-col justify-end">
            <span className="label">Total</span>
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold tabular-nums text-brand-800">
              {formatMoney(total)}
            </p>
          </div>
          <div />
          <SelectField
            name="billingMode" label="Como cobrar" required allowEmpty={false} span={2}
            options={optionsOf(billingModeLabels)} value={billingMode} onChange={setBillingMode}
          />
          {billingMode !== "PER_SESSION" && (
            <TextField
              name="firstDueDate" label="Primeiro vencimento" type="date"
              hint="Em branco: data da 1ª sessão"
            />
          )}
          {billingMode === "INSTALLMENTS" && (
            <TextField name="installments" label="Nº de parcelas" type="number" min={1} max={60} defaultValue={qty || 1} />
          )}
        </FormGrid>
        <div className="mt-4">
          <FormGrid cols={2}>
            <TextareaField name="notes" label="Observações" span={2} rows={2} />
          </FormGrid>
        </div>
      </div>

      <FormActions>
        <SubmitButton>Lançar e agendar</SubmitButton>
        <LinkButton href="/lancamentos" variant="outline">Cancelar</LinkButton>
      </FormActions>
    </ActionForm>
  );
}
