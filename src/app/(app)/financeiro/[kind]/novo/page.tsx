import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getFinanceOptions, kindFromSlug } from "@/lib/finance";
import { optionsOf, paymentMethodLabels } from "@/lib/labels";
import { todayString } from "@/lib/dates";
import {
  ActionForm, CheckboxField, FormActions, FormGrid, SelectField, SubmitButton, TextField, TextareaField,
} from "@/components/ui/form-kit";
import { Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { createEntry } from "../../actions";

export const metadata = { title: "Novo lançamento financeiro" };

export default async function NewEntryPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: slug } = await params;
  const kind = kindFromSlug(slug);
  if (!kind) notFound();
  const income = kind === "INCOME";

  const [options, parties] = await Promise.all([
    getFinanceOptions(kind),
    income
      ? db.patient.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : db.collaborator.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title={income ? "Nova receita" : "Nova despesa"}
        back={{ href: `/financeiro/${slug}`, label: income ? "Contas a receber" : "Contas a pagar" }}
      />
      <Card>
        <ActionForm action={createEntry}>
          <input type="hidden" name="kind" value={kind} />
          <FormGrid>
            <TextField name="description" label="Descrição" required span={2} />
            <TextField name="amount" label="Valor (R$)" required inputMode="decimal" />
            <TextField name="dueDate" label="Vencimento" type="date" required defaultValue={todayString()} />
            <TextField
              name="installments" label="Parcelas" type="number" min={1} max={60} defaultValue={1}
              hint="Parcelas mensais; o valor informado é dividido entre elas"
            />
            <SelectField name="categoryId" label="Categoria" options={options.categories} />
            {income ? (
              <SelectField
                name="patientId" label="Paciente"
                options={parties.map((p) => ({ value: p.id, label: p.name }))}
              />
            ) : (
              <SelectField
                name="collaboratorId" label="Colaborador / fornecedor"
                options={parties.map((p) => ({ value: p.id, label: p.name }))}
              />
            )}
            <TextareaField name="notes" label="Observações" span={3} rows={2} />
          </FormGrid>

          <div className="mt-6 border-t border-line pt-5">
            <CheckboxField
              name="paidNow"
              label={income ? "Já foi recebido" : "Já foi pago"}
              hint="Registra a baixa imediatamente, sem parcelamento"
            />
            <div className="mt-4">
              <FormGrid>
                <TextField name="paidOn" label="Data do pagamento" type="date" defaultValue={todayString()} />
                <SelectField name="accountId" label="Conta" options={options.accounts} />
                <SelectField name="paymentMethod" label="Forma de pagamento" options={optionsOf(paymentMethodLabels)} />
              </FormGrid>
            </div>
          </div>

          <FormActions>
            <SubmitButton>Salvar lançamento</SubmitButton>
            <LinkButton href={`/financeiro/${slug}`} variant="outline">Cancelar</LinkButton>
          </FormActions>
        </ActionForm>
      </Card>
    </>
  );
}
