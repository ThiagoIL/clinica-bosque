import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addDays, formatDate, formatTime, isDateString, todayString, weekdayName, zoned } from "@/lib/dates";
import { appointmentStatusLabel, appointmentStatusLabels, optionsOf } from "@/lib/labels";
import { appointmentTone } from "@/lib/status";
import { Badge, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";

export const metadata = { title: "Atendimento" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayString();
  const date = isDateString(param(sp.date)) ? param(sp.date)! : today;
  const status = param(sp.status) ?? "";

  const me = await db.user.findUnique({
    where: { id: user.id },
    select: { professionalId: true, professional: { select: { name: true } } },
  });

  if (!me?.professionalId) {
    return (
      <>
        <PageHeader title="Atendimento" description="Seus atendimentos do dia, com situação e evolução." />
        <EmptyState
          title="Seu usuário não está vinculado a um profissional"
          description={
            user.role === "ADMIN"
              ? "Em Usuários, edite o seu cadastro e marque que você é um profissional para ver aqui os seus atendimentos."
              : "Peça ao administrador para vincular o seu usuário ao seu cadastro de profissional (em Usuários)."
          }
          action={user.role === "ADMIN" ? <LinkButton href="/usuarios">Ir para Usuários</LinkButton> : undefined}
        />
      </>
    );
  }

  const items = await db.appointment.findMany({
    where: {
      professionalId: me.professionalId,
      startsAt: { gte: zoned(date, "00:00"), lt: zoned(addDays(date, 1), "00:00") },
      ...(status ? { status: status as keyof typeof appointmentStatusLabels } : { status: { not: "CANCELED" } }),
    },
    orderBy: { startsAt: "asc" },
    include: {
      patient: { select: { name: true } },
      service: { select: { name: true } },
      evolution: { select: { id: true } },
    },
  });

  const href = (d: string) => `/atendimento?date=${d}${status ? `&status=${status}` : ""}`;

  return (
    <>
      <PageHeader
        title="Atendimento"
        description={`Atendimentos de ${me.professional?.name ?? "você"}: informe a situação e registre a evolução.`}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-2">
          <Link href={href(addDays(date, -1))} className="btn btn-outline btn-sm" aria-label="Dia anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={href(today)} className="btn btn-outline btn-sm">Hoje</Link>
          <Link href={href(addDays(date, 1))} className="btn btn-outline btn-sm" aria-label="Próximo dia">
            <ChevronRight className="size-4" />
          </Link>
          <h2 className="ml-2 text-base capitalize">{weekdayName(date)}, {formatDate(date)}</h2>
        </div>
        <form action="/atendimento" method="get" className="ml-auto flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="a-date">Data</label>
            <input id="a-date" type="date" name="date" defaultValue={date} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="a-status">Situação</label>
            <select id="a-status" name="status" defaultValue={status} className="input">
              <option value="">Todas (sem cancelados)</option>
              {optionsOf(appointmentStatusLabels).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Filtrar</button>
        </form>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nenhum atendimento neste dia" description="Troque a data ou a situação para ver outros atendimentos." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Horário</th><th>Paciente</th><th>Serviço</th><th>Situação</th><th>Evolução</th><th /></tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap tabular-nums">{formatTime(a.startsAt)}–{formatTime(a.endsAt)}</td>
                  <td>
                    <Link href={`/atendimento/${a.id}`} className="font-medium text-brand-800 hover:underline">{a.patient.name}</Link>
                  </td>
                  <td>{a.service?.name ?? "Atendimento"}</td>
                  <td><Badge tone={appointmentTone(a.status)}>{appointmentStatusLabel(a.status, a.canceledBy)}</Badge></td>
                  <td>{a.evolution ? <Badge tone="green">Registrada</Badge> : <span className="text-muted">—</span>}</td>
                  <td className="text-right">
                    <Link href={`/atendimento/${a.id}`} className="text-sm text-brand-700 hover:underline">Atender</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
