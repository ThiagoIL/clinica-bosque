import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { centsToInput, formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { WEEKDAY_OPTIONS, attendanceKindLabels, billingModeLabels, optionsOf, recurrenceLabels } from "@/lib/labels";
import { ActionForm, DeleteButton, FormActions, FormGrid, SelectField, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { deleteEngagement, updateEngagement } from "../../actions";

export const metadata = { title: "Editar lançamento" };

export default async function EditEngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await db.engagement.findUnique({
    where: { id },
    include: {
      patient: { select: { name: true } },
      service: { select: { name: true } },
      appointments: { orderBy: { startsAt: "asc" }, select: { startsAt: true, status: true } },
      entries: { select: { status: true } },
    },
  });
  if (!e) notFound();
  if (e.status === "CANCELED") redirect(`/lancamentos/${id}`);

  const [professionals, services] = await Promise.all([
    db.professional.findMany({ where: { OR: [{ active: true }, { id: e.professionalId }] }, orderBy: { name: "asc" } }),
    db.service.findMany({ where: { OR: [{ active: true }, { id: e.serviceId }] }, orderBy: { name: "asc" } }),
  ]);

  const perSession = e.billingMode === "PER_SESSION";
  const paid = e.entries.filter((x) => x.status === "PAID").length;
  const first = e.appointments[0];
  const last = e.appointments[e.appointments.length - 1];

  return (
    <>
      <PageHeader
        title={`Editar lançamento #${e.number}`}
        description={`${e.service.name} · ${e.patient.name}`}
        back={{ href: `/lancamentos/${id}`, label: "Lançamento" }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card title="Dados do lançamento">
          <ActionForm action={updateEngagement}>
            <input type="hidden" name="id" value={e.id} />
            <FormGrid cols={2}>
              <SelectField
                name="professionalId" label="Profissional" required allowEmpty={false} defaultValue={e.professionalId}
                options={professionals.map((p) => ({ value: p.id, label: p.name }))}
                hint="Vale para os atendimentos futuros em aberto"
              />
              <SelectField
                name="serviceId" label="Serviço" required allowEmpty={false} defaultValue={e.serviceId}
                options={services.map((s) => ({ value: s.id, label: s.name }))}
                hint="Vale para os atendimentos futuros em aberto"
              />
              <SelectField
                name="kind" label="Tipo do atendimento" required allowEmpty={false} defaultValue={e.kind}
                options={optionsOf(attendanceKindLabels)}
              />
              {perSession ? (
                <>
                  <TextField
                    name="unitPrice" label="Valor por sessão (R$)" required inputMode="decimal"
                    defaultValue={centsToInput(e.unitPriceCents)}
                    hint="Recalcula as cobranças ainda não pagas"
                  />
                  <TextField
                    name="discount" label="Desconto total (R$)" inputMode="decimal"
                    defaultValue={e.discountCents ? centsToInput(e.discountCents) : ""}
                  />
                </>
              ) : (
                <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted sm:col-span-2">
                  Este lançamento tem cobrança {e.billingMode === "SINGLE" ? "única" : "parcelada"}: ajuste os valores e
                  vencimentos em <strong>Contas a receber</strong>.
                </p>
              )}
              <TextareaField name="notes" label="Observações" span={2} rows={3} defaultValue={e.notes} />
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar alterações</SubmitButton>
              <LinkButton href={`/lancamentos/${id}`} variant="outline">Cancelar</LinkButton>
              <span className="ml-auto">
                <DeleteButton
                  action={deleteEngagement} id={e.id} fields={{ redirect: "1" }}
                  message={`Excluir o lançamento #${e.number} de ${e.patient.name}? Os ${e.appointments.length} atendimento(s) e as cobranças dele serão removidos. Para manter o histórico, use “Cancelar lançamento”.`}
                >
                  Excluir lançamento
                </DeleteButton>
              </span>
            </FormActions>
          </ActionForm>
        </Card>

        <Card title="O que não muda aqui">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-muted">Sessões</dt><dd>{e.quantity} · {recurrenceLabels[e.recurrence].split(" (")[0]}</dd></div>
            {e.weekdays.length > 0 && (
              <div>
                <dt className="text-xs text-muted">Dias da semana</dt>
                <dd>{WEEKDAY_OPTIONS.filter((d) => e.weekdays.includes(d.value)).map((d) => d.label).join(", ")}</dd>
              </div>
            )}
            {first && <div><dt className="text-xs text-muted">Período</dt><dd>{formatDateTime(first.startsAt)}{last && last !== first ? ` → ${formatDateTime(last.startsAt)}` : ""}</dd></div>}
            <div><dt className="text-xs text-muted">Cobrança</dt><dd>{billingModeLabels[e.billingMode]} · total {formatMoney(e.totalCents)}</dd></div>
            <div><dt className="text-xs text-muted">Cobranças já pagas</dt><dd>{paid} (nunca são alteradas)</dd></div>
          </dl>
          <p className="mt-4 text-xs text-muted">
            Para mudar o dia ou horário de uma sessão, abra o lançamento e use <strong>Reagendar</strong> na sessão.
            Para sessões a mais ou a menos, cancele as sessões ou faça um novo lançamento.
          </p>
        </Card>
      </div>
    </>
  );
}
