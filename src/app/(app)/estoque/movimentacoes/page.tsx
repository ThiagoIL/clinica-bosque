import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, todayString } from "@/lib/dates";
import { optionsOf, stockMovementLabels } from "@/lib/labels";
import {
  ActionForm, CheckboxField, FormActions, FormGrid, SelectField, SubmitButton, TextField,
} from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, FilterBar, FilterField, PageHeader, Pagination, param } from "@/components/ui/primitives";
import { registerMovement } from "../actions";

export const metadata = { title: "Movimentações de estoque" };
const PAGE_SIZE = 30;

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const itemId = param(sp.item) ?? "";
  const page = Math.max(1, Number(param(sp.page)) || 1);
  const where = itemId ? { itemId } : {};

  const [items, suppliers, movements, total] = await Promise.all([
    db.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.stockMovement.findMany({
      where,
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { item: { select: { name: true, unit: true } }, supplier: { select: { name: true } } },
    }),
    db.stockMovement.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Movimentações de estoque"
        description="Entradas, saídas e ajustes. Compras podem gerar a conta a pagar automaticamente."
        back={{ href: "/estoque", label: "Estoque" }}
      />

      <Card title="Nova movimentação" className="mb-6">
        <ActionForm action={registerMovement} resetOnSuccess>
          <FormGrid cols={4}>
            <SelectField
              name="itemId" label="Item" required span={2} defaultValue={itemId}
              options={items.map((i) => ({ value: i.id, label: `${i.name} (saldo: ${i.quantity} ${i.unit})` }))}
            />
            <SelectField
              name="type" label="Tipo" required allowEmpty={false} defaultValue="OUT"
              options={optionsOf(stockMovementLabels)}
            />
            <TextField
              name="quantity" label="Quantidade" type="number" min={0} required
              hint="Em ajuste, informe o saldo contado"
            />
            <TextField name="occurredOn" label="Data" type="date" required defaultValue={todayString()} />
            <TextField name="reason" label="Motivo / observação" span={2} />
            <TextField name="unitCost" label="Custo unitário (R$) — só entradas" inputMode="decimal" />
            <SelectField
              name="supplierId" label="Fornecedor (entradas)"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <CheckboxField name="createPayable" label="Gerar conta a pagar da compra" hint="Valor = custo unitário × quantidade" span={2} />
            <TextField name="dueDate" label="Vencimento da conta" type="date" hint="Em branco: data da entrada" />
          </FormGrid>
          <FormActions>
            <SubmitButton>Registrar movimentação</SubmitButton>
          </FormActions>
        </ActionForm>
      </Card>

      <FilterBar action="/estoque/movimentacoes">
        <FilterField label="Item" className="min-w-64">
          <select name="item" defaultValue={itemId} className="input">
            <option value="">Todos os itens</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </FilterField>
      </FilterBar>

      {movements.length === 0 ? (
        <EmptyState title="Nenhuma movimentação registrada" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th><th>Item</th><th>Tipo</th><th className="text-right">Qtd.</th>
                <th className="text-right">Saldo</th><th className="text-right">Custo un.</th><th>Fornecedor</th><th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{formatDate(m.occurredOn)}</td>
                  <td className="font-medium">{m.item.name}</td>
                  <td>
                    <Badge tone={m.type === "IN" ? "green" : m.type === "OUT" ? "amber" : "blue"}>
                      {stockMovementLabels[m.type]}
                    </Badge>
                  </td>
                  <td className={`text-right tabular-nums ${m.quantity < 0 ? "text-red-600" : "text-brand-700"}`}>
                    {m.quantity > 0 ? "+" : ""}{m.quantity} <span className="text-xs text-muted">{m.item.unit}</span>
                  </td>
                  <td className="text-right tabular-nums">{m.balanceAfter}</td>
                  <td className="text-right tabular-nums">{m.unitCostCents != null ? formatMoney(m.unitCostCents) : "—"}</td>
                  <td>{m.supplier?.name ?? "—"}</td>
                  <td className="text-muted">{m.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/estoque/movimentacoes" params={{ item: itemId }} />
    </>
  );
}
