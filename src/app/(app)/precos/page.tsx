import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/db";
import { centsToInput } from "@/lib/money";
import { serviceKindLabels } from "@/lib/labels";
import {
  ActionForm, CheckboxField, FormActions, FormGrid, PriceInput, SelectField, SubmitButton, TextField,
} from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { copyPriceTable, savePriceTable } from "./actions";

export const metadata = { title: "Tabela de preços" };

export default async function PriceTablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const plans = await db.healthPlan.findMany({ where: { active: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  const plan = plans.find((p) => p.id === param(sp.plan)) ?? plans[0];

  const [services, products, servicePrices, productPrices] = await Promise.all([
    db.service.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.servicePrice.findMany({ where: { healthPlanId: plan.id } }),
    db.productPrice.findMany({ where: { healthPlanId: plan.id } }),
  ]);
  // muda quando os preços são salvos/copiados, para o formulário refletir os valores atuais
  const version = Math.max(0, ...servicePrices.map((p) => p.updatedAt.getTime()), ...productPrices.map((p) => p.updatedAt.getTime()));
  const sPrice = new Map(servicePrices.map((p) => [p.serviceId, p.priceCents]));
  const pPrice = new Map(productPrices.map((p) => [p.stockItemId, p.priceCents]));

  return (
    <>
      <PageHeader
        title="Tabela de preços"
        description="Valor de cada serviço e produto por plano de saúde. O valor é sugerido automaticamente ao lançar um atendimento."
        actions={<LinkButton href="/planos" variant="outline">Gerenciar planos</LinkButton>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {plans.map((p) => (
          <Link
            key={p.id}
            href={`/precos?plan=${p.id}`}
            className={clsx(
              "rounded-full border px-4 py-1.5 text-sm",
              p.id === plan.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface hover:bg-brand-50",
            )}
          >
            {p.name}
          </Link>
        ))}
      </div>

      <ActionForm key={`${plan.id}-${version}`} action={savePriceTable}>
        <input type="hidden" name="planId" value={plan.id} />
        <div className="space-y-6">
          <Card title={`Serviços — ${plan.name}`} padded={false}>
            {services.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Nenhum serviço cadastrado" action={<LinkButton href="/servicos?edit=new">Novo serviço</LinkButton>} />
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>Serviço</th><th>Tipo</th><th className="text-right">Preço (R$)</th></tr></thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td><Badge tone={s.kind === "RETURN" ? "amber" : "gray"}>{serviceKindLabels[s.kind]}</Badge></td>
                      <td className="text-right">
                        <PriceInput name={`s_${s.id}`} defaultValue={sPrice.has(s.id) ? centsToInput(sPrice.get(s.id)) : ""} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={`Produtos — ${plan.name}`} description="Itens do estoque com preço de venda" padded={false}>
            {products.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nenhum item de estoque cadastrado.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Produto</th><th>Unidade</th><th className="text-right">Preço (R$)</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td>{p.unit}</td>
                      <td className="text-right">
                        <PriceInput name={`p_${p.id}`} defaultValue={pPrice.has(p.id) ? centsToInput(pPrice.get(p.id)) : ""} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <FormActions>
          <SubmitButton>Salvar tabela de {plan.name}</SubmitButton>
          <span className="text-xs text-muted">Deixe em branco para “sem preço neste plano”.</span>
        </FormActions>
      </ActionForm>

      {plans.length > 1 && (
        <Card title="Copiar preços de outro plano" description={`Preenche a tabela de ${plan.name} a partir de outra, com ajuste opcional`} className="mt-8">
          <ActionForm action={copyPriceTable}>
            <input type="hidden" name="planId" value={plan.id} />
            <FormGrid cols={4}>
              <SelectField
                name="sourceId" label="Copiar de" required
                options={plans.filter((p) => p.id !== plan.id).map((p) => ({ value: p.id, label: p.name }))}
              />
              <TextField name="percent" label="Ajuste (%)" inputMode="decimal" hint="Ex.: -10 para 10% a menos, 15 para 15% a mais" />
              <CheckboxField name="overwrite" label="Sobrescrever preços já preenchidos" span={2} />
            </FormGrid>
            <FormActions>
              <SubmitButton variant="outline">Copiar preços</SubmitButton>
            </FormActions>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
