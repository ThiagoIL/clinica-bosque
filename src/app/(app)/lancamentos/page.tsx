import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { engagementStatusLabels, recurrenceLabels, optionsOf, serviceKindLabels } from "@/lib/labels";
import { engagementTone } from "@/lib/status";
import { Badge, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, Pagination, param } from "@/components/ui/primitives";

export const metadata = { title: "Lançamentos" };
const PAGE_SIZE = 20;

export default async function EngagementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = param(sp.status) ?? "";
  const patientId = param(sp.patientId) ?? "";
  const professionalId = param(sp.professionalId) ?? "";
  const page = Math.max(1, Number(param(sp.page)) || 1);

  const where: Prisma.EngagementWhereInput = {
    ...(status ? { status: status as "ACTIVE" | "COMPLETED" | "CANCELED" } : {}),
    ...(patientId ? { patientId } : {}),
    ...(professionalId ? { professionalId } : {}),
  };

  const [items, total, patients, professionals] = await Promise.all([
    db.engagement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        patient: { select: { name: true } },
        professional: { select: { name: true } },
        service: { select: { name: true, kind: true } },
        appointments: { select: { startsAt: true }, orderBy: { startsAt: "asc" }, take: 1 },
      },
    }),
    db.engagement.count({ where }),
    db.patient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.professional.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description="Consultas, sessões e terapias lançadas para os pacientes."
        actions={
          <LinkButton href="/lancamentos/novo">
            <Plus className="size-4" /> Novo lançamento
          </LinkButton>
        }
      />

      <FilterBar action="/lancamentos">
        <FilterField label="Paciente" className="min-w-52">
          <select name="patientId" defaultValue={patientId} className="input">
            <option value="">Todos</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Profissional" className="min-w-52">
          <select name="professionalId" defaultValue={professionalId} className="input">
            <option value="">Todos</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Situação">
          <select name="status" defaultValue={status} className="input">
            <option value="">Todas</option>
            {optionsOf(engagementStatusLabels).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FilterField>
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento encontrado"
          action={<LinkButton href="/lancamentos/novo">Novo lançamento</LinkButton>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nº</th><th>Paciente</th><th>Serviço</th><th>Profissional</th><th>Início</th>
                <th>Sessões</th><th className="text-right">Total</th><th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="tabular-nums text-muted">#{e.number}</td>
                  <td>
                    <Link href={`/lancamentos/${e.id}`} className="font-medium text-brand-800 hover:underline">
                      {e.patient.name}
                    </Link>
                  </td>
                  <td>
                    {e.service.name}
                    <p className="text-xs text-muted">{serviceKindLabels[e.service.kind]} · {recurrenceLabels[e.recurrence].split(" (")[0]}</p>
                  </td>
                  <td>{e.professional.name}</td>
                  <td className="whitespace-nowrap">{e.appointments[0] ? formatDateTime(e.appointments[0].startsAt) : "—"}</td>
                  <td className="tabular-nums">{e.quantity}</td>
                  <td className="text-right tabular-nums">{formatMoney(e.totalCents)}</td>
                  <td><Badge tone={engagementTone(e.status)}>{engagementStatusLabels[e.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page} pageSize={PAGE_SIZE} total={total} basePath="/lancamentos"
        params={{ status, patientId, professionalId }}
      />
    </>
  );
}
