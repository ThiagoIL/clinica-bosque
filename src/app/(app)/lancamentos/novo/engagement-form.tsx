"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ActionForm, FormActions, FormGrid, SelectField, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import {
  MAX_OCCURRENCES, endOfMonth, formatDate, occurrenceDates, weekdayName, type RecurrenceKind,
} from "@/lib/dates";
import { WEEKDAY_OPTIONS, attendanceKindLabels, billingModeLabels, optionsOf, recurrenceLabels, repeatEndLabels } from "@/lib/labels";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";
import { createEngagement } from "../actions";

type ServiceOption = {
  id: string;
  name: string;
  duration: number;
  /** preço em centavos por plano de saúde */
  prices: Record<string, number>;
};

type Props = {
  patients: { id: string; name: string; planId: string | null }[];
  professionals: { id: string; name: string; specialty: string | null }[];
  services: ServiceOption[];
  plans: { id: string; name: string; isDefault: boolean }[];
  defaults: { patientId?: string; professionalId?: string; date: string; time: string };
};

export function EngagementForm({ patients, professionals, services, plans, defaults }: Props) {
  const particularId = plans.find((p) => p.isDefault)?.id;
  const [patientId, setPatientId] = useState(defaults.patientId ?? "");
  const [kind, setKind] = useState("SESSION");
  const [serviceId, setServiceId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [duration, setDuration] = useState("50");
  const [discount, setDiscount] = useState("");
  const [startDate, setStartDate] = useState(defaults.date);
  const [recurrence, setRecurrence] = useState<RecurrenceKind>("NONE");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [repeatEnd, setRepeatEnd] = useState("COUNT");
  const [quantity, setQuantity] = useState("4");
  const [untilDate, setUntilDate] = useState("");
  const [untilMonth, setUntilMonth] = useState("");
  const [billingMode, setBillingMode] = useState("PER_SESSION");

  const patient = patients.find((p) => p.id === patientId);
  const plan = plans.find((p) => p.id === patient?.planId) ?? plans.find((p) => p.isDefault);
  const service = services.find((s) => s.id === serviceId);

  /** Sugere o valor da tabela de preços do plano do paciente (ou do Particular, se o plano não tiver). */
  function suggestPrice(svc: ServiceOption | undefined, pat: typeof patient) {
    if (!svc) {
      setUnitPrice("");
      setPriceNote("");
      return;
    }
    const planId = pat?.planId ?? particularId;
    const own = planId ? svc.prices[planId] : undefined;
    const fallback = particularId ? svc.prices[particularId] : undefined;
    const cents = own ?? fallback ?? 0;
    setUnitPrice(centsToInput(cents));
    const planName = plans.find((p) => p.id === planId)?.name ?? "Particular";
    setPriceNote(
      own !== undefined
        ? `Valor da tabela do plano ${planName}.`
        : fallback !== undefined
          ? `O plano ${planName} não tem preço para este serviço; usado o valor Particular. Confira.`
          : "Sem preço cadastrado para este serviço. Informe o valor.",
    );
  }

  function onPatientChange(id: string) {
    setPatientId(id);
    if (service) suggestPrice(service, patients.find((p) => p.id === id));
  }

  function onServiceChange(id: string) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) setDuration(String(svc.duration));
    suggestPrice(svc, patient);
  }

  const untilResolved =
    repeatEnd === "UNTIL_DATE" ? untilDate : repeatEnd === "UNTIL_MONTH" && untilMonth ? endOfMonth(`${untilMonth}-01`) : "";

  const dates = useMemo(() => {
    if (!startDate) return [];
    if (recurrence === "NONE") return [startDate];
    if (repeatEnd === "COUNT") {
      const n = Math.floor(Number(quantity) || 0);
      return n > 0 ? occurrenceDates(startDate, recurrence, { count: n, weekdays }) : [];
    }
    return untilResolved ? occurrenceDates(startDate, recurrence, { until: untilResolved, weekdays }) : [];
  }, [startDate, recurrence, repeatEnd, quantity, untilResolved, weekdays]);

  const qty = dates.length;
  const unit = parseMoney(unitPrice) ?? 0;
  const disc = parseMoney(discount) ?? 0;
  const total = Math.max(0, qty * unit - disc);
  const usesWeekdays = recurrence === "DAILY" || recurrence === "WEEKLY" || recurrence === "BIWEEKLY";

  const toggleWeekday = (d: number) => setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <ActionForm action={createEngagement} className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-4 text-sm">Atendimento</h2>
        <FormGrid>
          <SelectField
            name="patientId" label="Paciente" required value={patientId} onChange={onPatientChange}
            options={patients.map((p) => ({ value: p.id, label: p.name }))}
            hint={patient ? `Plano de saúde: ${plan?.name ?? "Particular"}` : undefined}
          />
          <SelectField
            name="professionalId" label="Profissional" required defaultValue={defaults.professionalId}
            options={professionals.map((p) => ({ value: p.id, label: p.specialty ? `${p.name} — ${p.specialty}` : p.name }))}
          />
          <SelectField
            name="kind" label="Tipo do atendimento" required allowEmpty={false}
            options={optionsOf(attendanceKindLabels)} value={kind} onChange={setKind}
          />
          <SelectField
            name="serviceId" label="Serviço" required value={serviceId} onChange={onServiceChange} span={2}
            options={services.map((s) => ({ value: s.id, label: s.name }))}
          />
        </FormGrid>
        {kind === "RETURN" && (
          <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
            Lançamento de <strong>retorno</strong>. Confira o valor abaixo — retornos costumam ter valor reduzido ou ser sem custo.
          </p>
        )}
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
        </FormGrid>

        {usesWeekdays && (
          <div className="mt-4">
            <span className="label">Dias da semana</span>
            <input type="hidden" name="weekdays" value={weekdays.join(",")} />
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={weekdays.includes(d.value)}
                  onClick={() => toggleWeekday(d.value)}
                  className={clsx(
                    "min-w-12 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    weekdays.includes(d.value)
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-line bg-surface text-muted hover:bg-brand-50",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              {weekdays.length > 0
                ? "As sessões acontecem nos dias marcados."
                : recurrence === "DAILY"
                  ? "Nenhum dia marcado: todos os dias."
                  : `Nenhum dia marcado: usa o dia da data inicial${startDate ? ` (${weekdayName(startDate)})` : ""}.`}
            </p>
          </div>
        )}

        {recurrence !== "NONE" && (
          <div className="mt-4">
            <FormGrid cols={4}>
              <SelectField
                name="repeatEnd" label="Terminar" required allowEmpty={false} span={2}
                options={optionsOf(repeatEndLabels)} value={repeatEnd} onChange={setRepeatEnd}
              />
              {repeatEnd === "COUNT" && (
                <TextField
                  name="quantity" label="Quantidade de sessões" type="number" min={1} max={MAX_OCCURRENCES} required
                  value={quantity} onChange={setQuantity}
                />
              )}
              {repeatEnd === "UNTIL_DATE" && (
                <TextField name="untilDate" label="Até a data (inclusive)" type="date" required value={untilDate} onChange={setUntilDate} />
              )}
              {repeatEnd === "UNTIL_MONTH" && (
                <TextField
                  name="untilMonth" label="Até o mês (inclusive)" type="month" required value={untilMonth} onChange={setUntilMonth}
                  hint="Vai até o último dia do mês"
                />
              )}
            </FormGrid>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-canvas px-3 py-2.5 text-xs">
          {dates.length === 0 ? (
            <span className="text-muted">
              {recurrence !== "NONE" && repeatEnd !== "COUNT" && !untilResolved
                ? "Informe até quando as sessões se repetem."
                : "Nenhuma sessão com os dados informados."}
            </span>
          ) : (
            <>
              <strong>{dates.length} sessão(ões):</strong>{" "}
              <span className="text-muted">
                {dates.slice(0, 12).map((d) => `${formatDate(d)} (${weekdayName(d).slice(0, 3)})`).join(" · ")}
                {dates.length > 12 ? ` … ${formatDate(dates[dates.length - 1])}` : ""}
              </span>
              {dates.length >= MAX_OCCURRENCES && (
                <span className="ml-1 font-medium text-red-600">Limite de {MAX_OCCURRENCES} sessões por lançamento.</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm">Valores e cobrança</h2>
        <FormGrid cols={4}>
          <TextField
            name="unitPrice" label="Valor por sessão (R$)" required inputMode="decimal"
            value={unitPrice} onChange={setUnitPrice} hint={priceNote || undefined}
          />
          <TextField name="discount" label="Desconto total (R$)" inputMode="decimal" value={discount} onChange={setDiscount} />
          <div className="flex flex-col justify-end">
            <span className="label">Total ({qty} sessão{qty === 1 ? "" : "ões"})</span>
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
            <TextField name="firstDueDate" label="Primeiro vencimento" type="date" hint="Em branco: data da 1ª sessão" />
          )}
          {billingMode === "INSTALLMENTS" && (
            <TextField name="installments" label="Nº de parcelas" type="number" min={1} max={60} defaultValue={1} />
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
