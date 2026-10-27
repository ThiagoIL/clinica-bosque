import Link from "next/link";
import clsx from "clsx";
import { Paperclip, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { addDays, dateOnly, formatDate, todayString } from "@/lib/dates";
import { EXPIRING_DAYS, contractDisplay } from "@/lib/contracts";
import { formatMoney } from "@/lib/money";
import { Badge, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, Pagination, Stat, param } from "@/components/ui/primitives";

export const metadata = { title: "Contratos" };
const PAGE_SIZE = 25;

const TABS = [
  { value: "active", label: "Ativos" },
  { value: "ended", label: "Encerrados" },
  { value: "all", label: "Todos" },
] as const;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = param(sp.status) ?? "active";
  const collaboratorId = param(sp.collaborator) ?? "";
  const q = param(sp.q)?.trim() ?? "";
  const page = Math.max(1, Number(param(sp.page)) || 1);

  const today = dateOnly(todayString());
  const soon = dateOnly(addDays(todayString(), EXPIRING_DAYS));

  const base: Prisma.ContractWhereInput = {
    ...(collaboratorId ? { collaboratorId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            { collaborator: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const statusWhere: Prisma.ContractWhereInput =
    status === "active" ? { status: "ACTIVE" }
    : status === "ended" ? { status: "ENDED" }
    : status === "attention" ? { status: "ACTIVE", endDate: { lte: soon } }
    : status === "expiring" ? { status: "ACTIVE", endDate: { gte: today, lte: soon } }
    : status === "expired" ? { status: "ACTIVE", endDate: { lt: today } }
    : {};
  const where: Prisma.ContractWhereInput = { AND: [base, statusWhere] };

  const [contracts, total, activeCount, expiringCount, expiredCount, endedCount, collaborators] = await Promise.all([
    db.contract.findMany({
      where,
      orderBy: [{ status: "asc" }, { endDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { collaborator: { select: { name: true } }, _count: { select: { files: true } } },
    }),
    db.contract.count({ where }),
    db.contract.count({ where: { AND: [base, { status: "ACTIVE" }] } }),
    db.contract.count({ where: { AND: [base, { status: "ACTIVE", endDate: { gte: today, lte: soon } }] } }),
    db.contract.count({ where: { AND: [base, { status: "ACTIVE", endDate: { lt: today } }] } }),
    db.contract.count({ where: { AND: [base, { status: "ENDED" }] } }),
    db.collaborator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const tabHref = (value: string) => {
    const sp2 = new URLSearchParams();
    if (collaboratorId) sp2.set("collaborator", collaboratorId);
    if (q) sp2.set("q", q);
    sp2.set("status", value);
    return `/contratos?${sp2.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Gestão dos contratos com colaboradores: ativos, a vencer, vencidos e encerrados, com anexos."
        actions={
          <LinkButton href={`/contratos/novo${collaboratorId ? `?collaborator=${collaboratorId}` : ""}`}>
            <Plus className="size-4" /> Novo contrato
          </LinkButton>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ativos" value={activeCount} tone="good" href={tabHref("active")} />
        <Stat label={`Vencem em ${EXPIRING_DAYS} dias`} value={expiringCount} tone={expiringCount ? "warn" : "default"} href={tabHref("expiring")} />
        <Stat label="Vencidos (sem encerrar)" value={expiredCount} tone={expiredCount ? "bad" : "default"} href={tabHref("expired")} />
        <Stat label="Encerrados" value={endedCount} href={tabHref("ended")} />
      </div>

      <div className="mb-3 inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={tabHref(t.value)}
            className={clsx("rounded-md px-3.5 py-1.5", status === t.value ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <FilterBar action="/contratos">
        <input type="hidden" name="status" value={status} />
        <FilterField label="Colaborador" className="min-w-52">
          <select name="collaborator" defaultValue={collaboratorId} className="input">
            <option value="">Todos</option>
            {collaborators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Buscar (título, nº ou colaborador)" className="min-w-64 flex-1">
          <input name="q" defaultValue={q} className="input" placeholder="Digite para buscar…" />
        </FilterField>
      </FilterBar>

      {contracts.length === 0 ? (
        <EmptyState
          title="Nenhum contrato encontrado"
          description="Ajuste os filtros ou cadastre um novo contrato."
          action={<LinkButton href="/contratos/novo">Novo contrato</LinkButton>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Colaborador</th><th>Contrato</th><th>Vigência</th><th className="text-right">Valor</th><th>Anexos</th><th>Situação</th><th />
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const st = contractDisplay(c);
                return (
                  <tr key={c.id}>
                    <td className="font-medium">{c.collaborator.name}</td>
                    <td>
                      <Link href={`/contratos/${c.id}`} className="font-medium text-brand-800 hover:underline">{c.title}</Link>
                      {c.code && <p className="text-xs text-muted">Nº {c.code}</p>}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : "indeterminado"}
                      {c.status === "ENDED" && c.endedOn && <p className="text-xs text-muted">encerrado em {formatDate(c.endedOn)}</p>}
                    </td>
                    <td className="text-right tabular-nums">
                      {c.valueCents != null ? formatMoney(c.valueCents) : "—"}
                      {c.valueNote && <p className="text-xs text-muted">{c.valueNote}</p>}
                    </td>
                    <td>
                      {c._count.files > 0 ? (
                        <span className="inline-flex items-center gap-1 text-muted"><Paperclip className="size-3.5" />{c._count.files}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="text-right">
                      <Link href={`/contratos/${c.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page} pageSize={PAGE_SIZE} total={total} basePath="/contratos"
        params={{ status, collaborator: collaboratorId, q }}
      />
    </>
  );
}
