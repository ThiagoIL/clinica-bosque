import Link from "next/link";
import { db } from "@/lib/db";
import { centsToInput, formatMoney } from "@/lib/money";
import {
  ActionForm, CheckboxField, FormActions, FormGrid, SubmitButton, TextField, TextareaField,
} from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { saveStockItem } from "./actions";

export const metadata = { title: "Estoque" };

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = param(sp.edit);
  const q = param(sp.q)?.trim() ?? "";
  const lowOnly = param(sp.low) === "1";

  const [itemsRaw, editing] = await Promise.all([
    db.stockItem.findMany({
      where: {
        active: true,
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { name: "asc" },
    }),
    editId && editId !== "new" ? db.stockItem.findUnique({ where: { id: editId } }) : null,
  ]);
  const items = lowOnly ? itemsRaw.filter((i) => i.quantity <= i.minQuantity) : itemsRaw;
  const lowCount = itemsRaw.filter((i) => i.quantity <= i.minQuantity).length;
  const stockValue = itemsRaw.reduce((s, i) => s + i.quantity * i.costCents, 0);

  return (
    <>
      <PageHeader
        title="Estoque"
        description={`${itemsRaw.length} itens ativos · valor em estoque ${formatMoney(stockValue)}${lowCount ? ` · ${lowCount} abaixo do mínimo` : ""}`}
        actions={
          <>
            <LinkButton href="/estoque/movimentacoes" variant="outline">Movimentações</LinkButton>
            {editId === undefined && <LinkButton href="/estoque?edit=new">Novo item</LinkButton>}
          </>
        }
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo item de estoque"} className="mb-6">
          <ActionForm action={saveStockItem}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid cols={4}>
              <TextField name="name" label="Nome" required span={2} defaultValue={editing?.name} />
              <TextField name="sku" label="Código (SKU)" defaultValue={editing?.sku} />
              <TextField name="category" label="Categoria" defaultValue={editing?.category} />
              <TextField name="unit" label="Unidade" required defaultValue={editing?.unit ?? "un"} hint="un, cx, pct, ml…" />
              <TextField name="minQuantity" label="Estoque mínimo" type="number" min={0} required defaultValue={editing?.minQuantity ?? 0} />
              <TextField name="cost" label="Custo unitário (R$)" inputMode="decimal" defaultValue={centsToInput(editing?.costCents ?? 0)} />
              {!editing && (
                <TextField name="initialQuantity" label="Quantidade inicial" type="number" min={0} defaultValue={0} />
              )}
              <TextareaField name="notes" label="Observações" span={3} rows={2} defaultValue={editing?.notes} />
              {editing && <CheckboxField name="active" label="Item ativo" defaultChecked={editing.active} />}
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/estoque" variant="outline">Cancelar</LinkButton>
            </FormActions>
          </ActionForm>
        </Card>
      )}

      <FilterBar action="/estoque">
        <FilterField label="Buscar" className="min-w-64 flex-1">
          <input name="q" defaultValue={q} className="input" placeholder="Nome ou código…" />
        </FilterField>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="size-4 accent-brand-600" />
          Somente abaixo do mínimo
        </label>
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState title="Nenhum item encontrado" action={<LinkButton href="/estoque?edit=new">Novo item</LinkButton>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th><th>Categoria</th><th className="text-right">Saldo</th>
                <th className="text-right">Mínimo</th><th className="text-right">Custo</th><th /><th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const low = i.quantity <= i.minQuantity;
                return (
                  <tr key={i.id}>
                    <td>
                      <span className="font-medium">{i.name}</span>
                      {i.sku && <span className="ml-2 text-xs text-muted">{i.sku}</span>}
                    </td>
                    <td>{i.category ?? "—"}</td>
                    <td className="text-right tabular-nums">
                      <span className={low ? "font-semibold text-red-600" : ""}>{i.quantity}</span>{" "}
                      <span className="text-xs text-muted">{i.unit}</span>
                    </td>
                    <td className="text-right tabular-nums">{i.minQuantity}</td>
                    <td className="text-right tabular-nums">{formatMoney(i.costCents)}</td>
                    <td>{low && <Badge tone="red">Repor</Badge>}</td>
                    <td className="space-x-3 text-right text-sm">
                      <Link href={`/estoque/movimentacoes?item=${i.id}`} className="text-brand-700 hover:underline">Movimentar</Link>
                      <Link href={`/estoque?edit=${i.id}`} className="text-brand-700 hover:underline">Editar</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
