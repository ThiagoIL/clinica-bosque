import { db } from "@/lib/db";
import {
  dateOnly, dateOnlyToString, endOfMonth, formatDate, isDateString, monthName, startOfMonth,
  startOfWeek, todayString,
} from "@/lib/dates";
import { balanceBefore } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { EmptyState, FilterBar, FilterField, PageHeader, Stat, param } from "@/components/ui/primitives";

export const metadata = { title: "Fluxo de caixa" };

type Bucket = { key: string; label: string; inPaid: number; inOpen: number; outPaid: number; outOpen: number };

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayString();
  const from = isDateString(param(sp.from)) ? param(sp.from)! : startOfMonth(today);
  const to = isDateString(param(sp.to)) ? param(sp.to)! : endOfMonth(today);
  const group = (["day", "week", "month"] as const).find((g) => g === param(sp.group)) ?? "day";

  const keyOf = (date: string): { key: string; label: string } => {
    if (group === "day") return { key: date, label: formatDate(date) };
    if (group === "week") {
      const start = startOfWeek(date);
      return { key: start, label: `Semana de ${formatDate(start)}` };
    }
    return { key: date.slice(0, 7), label: `${monthName(date)}/${date.slice(0, 4)}` };
  };

  const [opening, paid, open, overdue] = await Promise.all([
    balanceBefore(dateOnly(from)),
    db.financialEntry.findMany({
      where: { status: "PAID", paidOn: { gte: dateOnly(from), lte: dateOnly(to) } },
      select: { kind: true, paidOn: true, paidAmountCents: true, amountCents: true },
    }),
    db.financialEntry.findMany({
      where: { status: "PENDING", dueDate: { gte: dateOnly(from), lte: dateOnly(to) } },
      select: { kind: true, dueDate: true, amountCents: true },
    }),
    db.financialEntry.groupBy({
      by: ["kind"],
      where: { status: "PENDING", dueDate: { lt: dateOnly(from) } },
      _sum: { amountCents: true },
    }),
  ]);

  const buckets = new Map<string, Bucket>();
  const bucket = (date: string) => {
    const { key, label } = keyOf(date);
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { key, label, inPaid: 0, inOpen: 0, outPaid: 0, outOpen: 0 }));
    return b;
  };
  for (const e of paid) {
    const b = bucket(dateOnlyToString(e.paidOn!));
    const v = e.paidAmountCents ?? e.amountCents;
    if (e.kind === "INCOME") b.inPaid += v;
    else b.outPaid += v;
  }
  for (const e of open) {
    const b = bucket(dateOnlyToString(e.dueDate));
    if (e.kind === "INCOME") b.inOpen += e.amountCents;
    else b.outOpen += e.amountCents;
  }

  const rows = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  const totalIn = rows.reduce((s, r) => s + r.inPaid + r.inOpen, 0);
  const totalOut = rows.reduce((s, r) => s + r.outPaid + r.outOpen, 0);
  const maxBar = Math.max(1, ...rows.map((r) => Math.max(r.inPaid + r.inOpen, r.outPaid + r.outOpen)));
  const overdueIn = overdue.find((o) => o.kind === "INCOME")?._sum.amountCents ?? 0;
  const overdueOut = overdue.find((o) => o.kind === "EXPENSE")?._sum.amountCents ?? 0;

  let running = opening;

  return (
    <>
      <PageHeader
        title="Fluxo de caixa"
        description="Realizado (pago/recebido) e previsto (em aberto) por data, com saldo acumulado."
      />

      <FilterBar action="/financeiro/fluxo">
        <FilterField label="De">
          <input type="date" name="from" defaultValue={from} className="input" />
        </FilterField>
        <FilterField label="Até">
          <input type="date" name="to" defaultValue={to} className="input" />
        </FilterField>
        <FilterField label="Agrupar por">
          <select name="group" defaultValue={group} className="input">
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>
        </FilterField>
      </FilterBar>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo inicial" value={formatMoney(opening)} />
        <Stat label="Entradas (real + prev.)" value={formatMoney(totalIn)} tone="good" />
        <Stat label="Saídas (real + prev.)" value={formatMoney(totalOut)} tone="bad" />
        <Stat label="Saldo projetado" value={formatMoney(opening + totalIn - totalOut)} />
      </div>

      {(overdueIn > 0 || overdueOut > 0) && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Há contas vencidas antes deste período e ainda em aberto: a receber {formatMoney(overdueIn)} · a pagar{" "}
          {formatMoney(overdueOut)}. Elas não entram nos totais abaixo.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Sem movimentações ou vencimentos no período" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Período</th>
                <th className="text-right">Entradas realizadas</th>
                <th className="text-right">Entradas previstas</th>
                <th className="text-right">Saídas realizadas</th>
                <th className="text-right">Saídas previstas</th>
                <th className="text-right">Saldo do período</th>
                <th className="text-right">Acumulado</th>
                <th className="w-40" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inTotal = r.inPaid + r.inOpen;
                const outTotal = r.outPaid + r.outOpen;
                const net = inTotal - outTotal;
                running += net;
                return (
                  <tr key={r.key}>
                    <td className="whitespace-nowrap font-medium">{r.label}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.inPaid)}</td>
                    <td className="text-right tabular-nums text-muted">{formatMoney(r.inOpen)}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.outPaid)}</td>
                    <td className="text-right tabular-nums text-muted">{formatMoney(r.outOpen)}</td>
                    <td className={`text-right tabular-nums font-medium ${net < 0 ? "text-red-600" : "text-brand-700"}`}>
                      {formatMoney(net)}
                    </td>
                    <td className={`text-right tabular-nums font-medium ${running < 0 ? "text-red-600" : ""}`}>
                      {formatMoney(running)}
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(inTotal / maxBar) * 100}%` }} />
                        <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${(outTotal / maxBar) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Realizado considera a data do pagamento; previsto considera o vencimento das contas em aberto.
      </p>
    </>
  );
}
