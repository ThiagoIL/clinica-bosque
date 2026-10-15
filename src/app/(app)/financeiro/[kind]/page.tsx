import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { dateOnly, formatDate, isDateString, todayString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { entryDisplayStatus } from "@/lib/status";
import { kindFromSlug } from "@/lib/finance";
import {
  Badge, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, Pagination, Stat, param,
} from "@/components/ui/primitives";

const PAGE_SIZE = 25;

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: kind === "receber" ? "Contas a receber" : "Contas a pagar" };
}

export default async function EntriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind: slug } = await params;
  const kind = kindFromSlug(slug);
  if (!kind) notFound();
  const income = kind === "INCOME";

  const sp = await searchParams;
  const status = param(sp.status) ?? "open";
  const from = isDateString(param(sp.from)) ? param(sp.from)! : "";
  const to = isDateString(param(sp.to)) ? param(sp.to)! : "";
  const q = param(sp.q)?.trim() ?? "";
  const partyId = param(sp.party) ?? "";
  const page = Math.max(1, Number(param(sp.page)) || 1);
  const today = dateOnly(todayString());

  const base: Prisma.FinancialEntryWhereInput = {
    kind,
    ...(from || to ? { dueDate: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } } : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" } } : {}),
    ...(partyId ? (income ? { patientId: partyId } : { supplierId: partyId }) : {}),
  };

  const statusWhere: Prisma.FinancialEntryWhereInput =
    status === "open"
      ? { status: "PENDING" }
      : status === "overdue"
        ? { status: "PENDING", dueDate: { lt: today } }
        : status === "paid"
          ? { status: "PAID" }
          : status === "canceled"
            ? { status: "CANCELED" }
            : {};
  // quando há filtro de período e de status vencido, o gte/lte do período precisa conviver com lt
  const where: Prisma.FinancialEntryWhereInput = { AND: [base, statusWhere] };

  const [entries, total, byStatus, overdueSum, parties] = await Promise.all([
    db.financialEntry.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { patient: { select: { name: true } }, supplier: { select: { name: true } }, category: { select: { name: true } } },
    }),
    db.financialEntry.count({ where }),
    db.financialEntry.groupBy({ by: ["status"], where: base, _sum: { amountCents: true, paidAmountCents: true } }),
    db.financialEntry.aggregate({ where: { AND: [base, { status: "PENDING", dueDate: { lt: today } }] }, _sum: { amountCents: true } }),
    income
      ? db.patient.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const pending = byStatus.find((s) => s.status === "PENDING")?._sum.amountCents ?? 0;
  const paid = byStatus.find((s) => s.status === "PAID")?._sum.paidAmountCents ?? 0;
  const overdue = overdueSum._sum.amountCents ?? 0;

  return (
    <>
      <PageHeader
        title={income ? "Contas a receber" : "Contas a pagar"}
        description={
          income
            ? "Cobranças geradas pelos atendimentos e demais receitas."
            : "Despesas, fornecedores e compromissos da clínica."
        }
        actions={
          <LinkButton href={`/financeiro/${slug}/novo`}>
            <Plus className="size-4" /> {income ? "Nova receita" : "Nova despesa"}
          </LinkButton>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Em aberto" value={formatMoney(pending)} tone="warn" />
        <Stat label="Vencido" value={formatMoney(overdue)} tone={overdue > 0 ? "bad" : "default"} />
        <Stat label={income ? "Recebido" : "Pago"} value={formatMoney(paid)} tone="good" />
      </div>

      <FilterBar action={`/financeiro/${slug}`}>
        <FilterField label="Situação">
          <select name="status" defaultValue={status} className="input">
            <option value="open">Em aberto</option>
            <option value="overdue">Vencidas</option>
            <option value="paid">{income ? "Recebidas" : "Pagas"}</option>
            <option value="canceled">Canceladas</option>
            <option value="all">Todas</option>
          </select>
        </FilterField>
        <FilterField label="Vencimento de">
          <input type="date" name="from" defaultValue={from} className="input" />
        </FilterField>
        <FilterField label="até">
          <input type="date" name="to" defaultValue={to} className="input" />
        </FilterField>
        <FilterField label={income ? "Paciente" : "Fornecedor"}>
          <select name="party" defaultValue={partyId} className="input">
            <option value="">Todos</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Descrição" className="min-w-48 flex-1">
          <input name="q" defaultValue={q} className="input" placeholder="Buscar…" />
        </FilterField>
      </FilterBar>

      {entries.length === 0 ? (
        <EmptyState title="Nenhum lançamento encontrado" description="Ajuste os filtros ou cadastre um novo lançamento." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Descrição</th>
                <th>{income ? "Paciente" : "Fornecedor"}</th>
                <th>Categoria</th>
                <th className="text-right">Valor</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const st = entryDisplayStatus(e);
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDate(e.dueDate)}</td>
                    <td className="font-medium">{e.description}</td>
                    <td>{(income ? e.patient?.name : e.supplier?.name) ?? "—"}</td>
                    <td>{e.category?.name ?? "—"}</td>
                    <td className="text-right tabular-nums">{formatMoney(e.amountCents)}</td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {e.status === "PAID" && e.paidOn && (
                        <span className="ml-1.5 text-xs text-muted">{formatDate(e.paidOn)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link href={`/financeiro/${slug}/${e.id}`} className="text-sm text-brand-700 hover:underline">
                        {e.status === "PENDING" ? (income ? "Receber" : "Pagar") : "Abrir"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page} pageSize={PAGE_SIZE} total={total} basePath={`/financeiro/${slug}`}
        params={{ status, from, to, q, party: partyId }}
      />
    </>
  );
}
