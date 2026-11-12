import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { addDays, formatDateTime, isDateString, zoned } from "@/lib/dates";
import { attendanceKindLabels, engagementStatusLabels, recurrenceLabels, optionsOf } from "@/lib/labels";
import { engagementTone } from "@/lib/status";
import { requireUser } from "@/lib/auth";
import { ownProfessionalId } from "@/lib/scope";
import { Badge, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, Pagination, param } from "@/components/ui/primitives";
import { AbaBadge } from "@/components/aba-badge";
import { SearchSelect } from "@/components/search-select";

export const metadata = { title: "Lançamentos" };
const PAGE_SIZE = 20;

export default async function EngagementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // o profissional logado só vê os próprios lançamentos
  const own = await ownProfessionalId((await requireUser()).id);
  const status = param(sp.status) ?? "";
  // paciente/profissional: busca por nome (ou, vindo de um link, pelo id)
  const patientIdParam = param(sp.patientId) ?? "";
  const professionalIdParam = param(sp.professionalId) ?? "";
  let patientQ = param(sp.patient)?.trim() ?? "";
  let professionalQ = own ? "" : (param(sp.professional)?.trim() ?? "");
  const specialtyId = own ? "" : (param(sp.specialtyId) ?? "");
  // ABA: "1" só pacientes ABA, "0" só os que não são
  const abaParam = param(sp.aba);
  const aba = abaParam === "1" ? true : abaParam === "0" ? false : undefined;
  const kindParam = param(sp.kind) ?? "";
  const kind = kindParam in attendanceKindLabels ? (kindParam as keyof typeof attendanceKindLabels) : undefined;
  const from = isDateString(param(sp.from)) ? param(sp.from)! : "";
  const to = isDateString(param(sp.to)) ? param(sp.to)! : "";
  const page = Math.max(1, Number(param(sp.page)) || 1);

  if (!patientQ && patientIdParam) {
    patientQ = (await db.patient.findUnique({ where: { id: patientIdParam }, select: { name: true } }))?.name ?? "";
  }
  if (!own && !professionalQ && professionalIdParam) {
    professionalQ = (await db.professional.findUnique({ where: { id: professionalIdParam }, select: { name: true } }))?.name ?? "";
  }

  const where: Prisma.EngagementWhereInput = {
    ...(status ? { status: status as "ACTIVE" | "COMPLETED" | "CANCELED" } : {}),
    ...(patientQ ? { patient: { name: { contains: patientQ, mode: "insensitive" } } } : {}),
    ...(own ? { professionalId: own } : {}),
    ...(professionalQ ? { professional: { name: { contains: professionalQ, mode: "insensitive" }, ...(specialtyId ? { specialtyId } : {}) } } : {}),
    ...(specialtyId && !professionalQ ? { professional: { specialtyId } } : {}),
    ...(kind ? { kind } : {}),
    ...(aba !== undefined ? { aba } : {}),
    // período: lançamentos com algum atendimento entre as datas
    ...(from || to
      ? {
          appointments: {
            some: {
              startsAt: {
                ...(from ? { gte: zoned(from, "00:00") } : {}),
                ...(to ? { lt: zoned(addDays(to, 1), "00:00") } : {}),
              },
            },
          },
        }
      : {}),
  };

  const [items, total, patients, professionals, specialties] = await Promise.all([
    db.engagement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        patient: { select: { name: true } },
        professional: { select: { name: true } },
        service: { select: { name: true } },
        appointments: { select: { startsAt: true }, orderBy: { startsAt: "asc" }, take: 1 },
      },
    }),
    db.engagement.count({ where }),
    db.patient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.professional.findMany({
      where: { attends: true, ...(specialtyId ? { specialtyId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.specialty.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description={own ? "Os seus lançamentos de consultas, sessões e terapias." : "Consultas, sessões e terapias lançadas para os pacientes."}
        actions={
          <LinkButton href="/lancamentos/novo">
            <Plus className="size-4" /> Novo lançamento
          </LinkButton>
        }
      />

      <FilterBar action="/lancamentos">
        <FilterField label="Paciente" className="min-w-52">
          <input name="patient" defaultValue={patientQ} list="f-patients" placeholder="Digite para buscar…" autoComplete="off" className="input" />
          <datalist id="f-patients">{patients.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </FilterField>
        {!own && (
          <>
            <FilterField label="Especialidade" className="min-w-44">
              <SearchSelect
                name="specialtyId" defaultValue={specialtyId} emptyLabel="Todas"
                options={specialties.map((s) => ({ value: s.id, label: s.name }))}
              />
            </FilterField>
            <FilterField label="Profissional" className="min-w-52">
              <input name="professional" defaultValue={professionalQ} list="f-professionals" placeholder="Digite para buscar…" autoComplete="off" className="input" />
              <datalist id="f-professionals">{professionals.map((p) => <option key={p.id} value={p.name} />)}</datalist>
            </FilterField>
          </>
        )}
        <FilterField label="Atendimentos de">
          <input type="date" name="from" defaultValue={from} className="input" />
        </FilterField>
        <FilterField label="até">
          <input type="date" name="to" defaultValue={to} className="input" />
        </FilterField>
        <FilterField label="Tipo">
          <select name="kind" defaultValue={kind ?? ""} className="input">
            <option value="">Todos</option>
            {optionsOf(attendanceKindLabels).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="Paciente ABA">
          <select name="aba" defaultValue={abaParam === "1" || abaParam === "0" ? abaParam : ""} className="input">
            <option value="">Todos</option>
            <option value="1">Somente ABA</option>
            <option value="0">Não ABA</option>
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
                <th>Sessões</th><th className="text-right">Total</th><th>Situação</th><th />
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
                    {e.aba && <span className="ml-2 align-middle"><AbaBadge /></span>}
                  </td>
                  <td>
                    {e.service.name}
                    <p className="text-xs text-muted">{attendanceKindLabels[e.kind]} · {recurrenceLabels[e.recurrence].split(" (")[0]}</p>
                  </td>
                  <td>{e.professional.name}</td>
                  <td className="whitespace-nowrap">{e.appointments[0] ? formatDateTime(e.appointments[0].startsAt) : "—"}</td>
                  <td className="tabular-nums">{e.quantity}</td>
                  <td className="text-right tabular-nums">{formatMoney(e.totalCents)}</td>
                  <td><Badge tone={engagementTone(e.status)}>{engagementStatusLabels[e.status]}</Badge></td>
                  <td className="whitespace-nowrap text-right">
                    <Link
                      href={e.status === "CANCELED" ? `/lancamentos/${e.id}` : `/lancamentos/${e.id}/editar`}
                      className="text-sm text-brand-700 hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page} pageSize={PAGE_SIZE} total={total} basePath="/lancamentos"
        params={{ status, patient: patientQ, professional: professionalQ, specialtyId, kind: kind ?? "", aba: abaParam === "1" || abaParam === "0" ? abaParam : "", from, to }}
      />
    </>
  );
}
