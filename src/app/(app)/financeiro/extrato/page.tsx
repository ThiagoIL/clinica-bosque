import Link from "next/link";
import { db } from "@/lib/db";
import { dateOnly, endOfMonth, formatDate, isDateString, startOfMonth, todayString } from "@/lib/dates";
import { balanceBefore } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { paymentMethodLabels } from "@/lib/labels";
import { EmptyState, FilterBar, FilterField, PageHeader, Stat, param } from "@/components/ui/primitives";

export const metadata = { title: "Extrato" };

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayString();
  const from = isDateString(param(sp.from)) ? param(sp.from)! : startOfMonth(today);
  const to = isDateString(param(sp.to)) ? param(sp.to)! : endOfMonth(today);
  const accountId = param(sp.account) ?? "";

  const accounts = await db.financialAccount.findMany({ orderBy: { name: "asc" } });

  const [opening, entries] = await Promise.all([
    balanceBefore(dateOnly(from), accountId || undefined),
    db.financialEntry.findMany({
      where: {
        status: "PAID",
        paidOn: { gte: dateOnly(from), lte: dateOnly(to) },
        ...(accountId ? { accountId } : {}),
      },
      orderBy: [{ paidOn: "asc" }, { updatedAt: "asc" }],
      include: {
        account: { select: { name: true } },
        patient: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    }),
  ]);

  let running = opening;
  let totalIn = 0;
  let totalOut = 0;
  const rows = entries.map((e) => {
    const value = e.paidAmountCents ?? e.amountCents;
    if (e.kind === "INCOME") {
      totalIn += value;
      running += value;
    } else {
      totalOut += value;
      running -= value;
    }
    return { e, value, balance: running };
  });

  return (
    <>
      <PageHeader title="Extrato" description="Movimentações efetivamente pagas e recebidas, com saldo corrido." />

      <FilterBar action="/financeiro/extrato">
        <FilterField label="Conta">
          <select name="account" defaultValue={accountId} className="input">
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="De">
          <input type="date" name="from" defaultValue={from} className="input" />
        </FilterField>
        <FilterField label="Até">
          <input type="date" name="to" defaultValue={to} className="input" />
        </FilterField>
      </FilterBar>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo anterior" value={formatMoney(opening)} />
        <Stat label="Entradas" value={formatMoney(totalIn)} tone="good" />
        <Stat label="Saídas" value={formatMoney(totalOut)} tone="bad" />
        <Stat label="Saldo final" value={formatMoney(opening + totalIn - totalOut)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Sem movimentações no período" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Conta</th>
                <th>Forma</th>
                <th className="text-right">Entrada</th>
                <th className="text-right">Saída</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, value, balance }) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{formatDate(e.paidOn)}</td>
                  <td>
                    <Link
                      href={`/financeiro/${e.kind === "INCOME" ? "receber" : "pagar"}/${e.id}`}
                      className="font-medium hover:underline"
                    >
                      {e.description}
                    </Link>
                    <p className="text-xs text-muted">{e.patient?.name ?? e.supplier?.name ?? ""}</p>
                  </td>
                  <td>{e.account?.name ?? "—"}</td>
                  <td>{e.paymentMethod ? paymentMethodLabels[e.paymentMethod] : "—"}</td>
                  <td className="text-right tabular-nums text-brand-700">{e.kind === "INCOME" ? formatMoney(value) : ""}</td>
                  <td className="text-right tabular-nums text-red-600">{e.kind === "EXPENSE" ? formatMoney(value) : ""}</td>
                  <td className="text-right tabular-nums font-medium">{formatMoney(balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
