import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { centsToInput, formatMoney } from "@/lib/money";
import { dateOnlyToString, formatDate, todayString } from "@/lib/dates";
import { getFinanceOptions, kindFromSlug } from "@/lib/finance";
import { entryDisplayStatus } from "@/lib/status";
import { optionsOf, paymentMethodLabels } from "@/lib/labels";
import {
  ActionForm, ConfirmSubmit, FormActions, FormGrid, SelectField, SubmitButton, TextField, TextareaField,
} from "@/components/ui/form-kit";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { cancelEntry, reopenEntry, settleEntry, updateEntry } from "../../actions";

export const metadata = { title: "Lançamento financeiro" };

export default async function EntryPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind: slug, id } = await params;
  const kind = kindFromSlug(slug);
  if (!kind) notFound();
  const entry = await db.financialEntry.findUnique({
    where: { id },
    include: {
      account: true,
      engagement: { select: { id: true, number: true } },
      appointment: { select: { id: true, startsAt: true } },
    },
  });
  if (!entry || entry.kind !== kind) notFound();
  const income = kind === "INCOME";

  const [options, parties] = await Promise.all([
    getFinanceOptions(kind),
    income
      ? db.patient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : db.collaborator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const st = entryDisplayStatus(entry);
  const pending = entry.status === "PENDING";

  return (
    <>
      <PageHeader
        title={entry.description}
        back={{ href: `/financeiro/${slug}`, label: income ? "Contas a receber" : "Contas a pagar" }}
        actions={<Badge tone={st.tone}>{st.label}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title="Dados do lançamento">
          {pending ? (
            <ActionForm action={updateEntry}>
              <input type="hidden" name="id" value={entry.id} />
              <FormGrid cols={2}>
                <TextField name="description" label="Descrição" required span={2} defaultValue={entry.description} />
                <TextField name="amount" label="Valor (R$)" required inputMode="decimal" defaultValue={centsToInput(entry.amountCents)} />
                <TextField name="dueDate" label="Vencimento" type="date" required defaultValue={dateOnlyToString(entry.dueDate)} />
                <SelectField name="categoryId" label="Categoria" options={options.categories} defaultValue={entry.categoryId} />
                {income ? (
                  <SelectField
                    name="patientId" label="Paciente" defaultValue={entry.patientId}
                    options={parties.map((p) => ({ value: p.id, label: p.name }))}
                  />
                ) : (
                  <SelectField
                    name="collaboratorId" label="Colaborador / fornecedor" defaultValue={entry.collaboratorId}
                    options={parties.map((p) => ({ value: p.id, label: p.name }))}
                  />
                )}
                <TextareaField name="notes" label="Observações" span={2} rows={2} defaultValue={entry.notes} />
              </FormGrid>
              <FormActions>
                <SubmitButton>Salvar alterações</SubmitButton>
              </FormActions>
            </ActionForm>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Valor" value={formatMoney(entry.amountCents)} />
              <Info label="Vencimento" value={formatDate(entry.dueDate)} />
              <Info label="Categoria" value={options.categories.find((c) => c.value === entry.categoryId)?.label ?? "—"} />
              <Info
                label={income ? "Paciente" : "Colaborador / fornecedor"}
                value={parties.find((p) => p.id === (income ? entry.patientId : entry.collaboratorId))?.name ?? "—"}
              />
              <Info label="Observações" value={entry.notes ?? "—"} />
            </dl>
          )}
          {(entry.engagement || entry.appointment) && (
            <p className="mt-4 text-xs text-muted">
              Origem:{" "}
              {entry.engagement && (
                <Link href={`/lancamentos/${entry.engagement.id}`} className="text-brand-700 hover:underline">
                  Lançamento nº {entry.engagement.number}
                </Link>
              )}
            </p>
          )}
        </Card>

        <div className="space-y-6">
          {pending && (
            <Card title={income ? "Registrar recebimento" : "Registrar pagamento"}>
              <ActionForm action={settleEntry} className="space-y-4">
                <input type="hidden" name="id" value={entry.id} />
                <TextField name="paidOn" label="Data" type="date" required defaultValue={todayString()} />
                <TextField
                  name="paidAmount" label="Valor efetivo (R$)" inputMode="decimal"
                  hint="Deixe em branco para usar o valor do lançamento"
                  defaultValue={centsToInput(entry.amountCents)}
                />
                <SelectField name="accountId" label="Conta" required options={options.accounts} />
                <SelectField name="paymentMethod" label="Forma de pagamento" options={optionsOf(paymentMethodLabels)} />
                <SubmitButton className="w-full">Confirmar baixa</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {entry.status === "PAID" && (
            <Card title={income ? "Recebimento" : "Pagamento"}>
              <dl className="space-y-2 text-sm">
                <Info label="Data" value={formatDate(entry.paidOn)} />
                <Info label="Valor" value={formatMoney(entry.paidAmountCents)} />
                <Info label="Conta" value={entry.account?.name ?? "—"} />
                <Info label="Forma" value={entry.paymentMethod ? paymentMethodLabels[entry.paymentMethod] : "—"} />
              </dl>
              <ActionForm action={reopenEntry} className="mt-4">
                <input type="hidden" name="id" value={entry.id} />
                <ConfirmSubmit message="Reabrir este lançamento? A baixa será desfeita." variant="outline">
                  Reabrir lançamento
                </ConfirmSubmit>
              </ActionForm>
            </Card>
          )}

          {entry.status !== "PAID" && entry.status !== "CANCELED" && (
            <Card title="Cancelar">
              <p className="mb-3 text-sm text-muted">
                Cancelar mantém o histórico, mas remove o valor das contas em aberto e do fluxo de caixa.
              </p>
              <ActionForm action={cancelEntry}>
                <input type="hidden" name="id" value={entry.id} />
                <ConfirmSubmit message="Cancelar este lançamento?">Cancelar lançamento</ConfirmSubmit>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
