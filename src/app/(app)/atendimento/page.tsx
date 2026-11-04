import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addDays, formatDate, formatTime, isDateString, localParts, todayString, weekdayShort, zoned } from "@/lib/dates";
import { appointmentStatusLabel, appointmentStatusLabels, optionsOf } from "@/lib/labels";
import { appointmentTone } from "@/lib/status";
import { Badge, EmptyState, PageHeader, param } from "@/components/ui/primitives";

export const metadata = { title: "Atendimento" };

const LIMIT = 300;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayString();
  // período "entre": início e fim (padrão: hoje); um dia só quando só uma das datas é informada
  let from = isDateString(param(sp.from)) ? param(sp.from)! : "";
  let to = isDateString(param(sp.to)) ? param(sp.to)! : "";
  if (!from && !to) from = to = today;
  else if (!from) from = to;
  else if (!to) to = from;
  if (from > to) [from, to] = [to, from];
  const status = param(sp.status) ?? "";
  const isAdmin = user.role === "ADMIN";

  const me = await db.user.findUnique({
    where: { id: user.id },
    select: { professionalId: true, professional: { select: { name: true } } },
  });

  // o administrador vê os atendimentos de todos (e pode filtrar por profissional); os demais, só os seus
  if (!isAdmin && !me?.professionalId) {
    return (
      <>
        <PageHeader title="Atendimento" description="Seus atendimentos, com situação e evolução." />
        <EmptyState
          title="Seu usuário não está vinculado a um profissional"
          description="Peça ao administrador para vincular o seu usuário ao seu cadastro de profissional (em Usuários)."
        />
      </>
    );
  }

  const professionals = isAdmin
    ? await db.professional.findMany({ where: { attends: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  const professionalId = isAdmin ? (professionals.some((p) => p.id === param(sp.professionalId)) ? param(sp.professionalId)! : "") : me!.professionalId!;

  const where: Prisma.AppointmentWhereInput = {
    ...(professionalId ? { professionalId } : {}),
    startsAt: { gte: zoned(from, "00:00"), lt: zoned(addDays(to, 1), "00:00") },
    ...(status ? { status: status as keyof typeof appointmentStatusLabels } : { status: { not: "CANCELED" } }),
  };
  const [items, total] = await Promise.all([
    db.appointment.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: LIMIT,
      include: {
        patient: { select: { name: true } },
        professional: { select: { name: true } },
        service: { select: { name: true } },
        evolution: { select: { id: true, author: { select: { name: true } } } },
        statusChangedBy: { select: { name: true } },
      },
    }),
    db.appointment.count({ where }),
  ]);

  const oneDay = from === to;
  const query = (over: Record<string, string>) => {
    const q = new URLSearchParams({ from, to, ...(status ? { status } : {}), ...(isAdmin && professionalId ? { professionalId } : {}), ...over });
    return `/atendimento?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Atendimento"
        description={
          isAdmin
            ? "Atendimentos de todos os profissionais. O que você registrar fica com o seu nome."
            : `Atendimentos de ${me?.professional?.name ?? "você"}: informe a situação e registre a evolução.`
        }
      />

      <div className="card mb-4 p-4">
        <form action="/atendimento" method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="a-from">De</label>
            <input id="a-from" type="date" name="from" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="a-to">Até</label>
            <input id="a-to" type="date" name="to" defaultValue={to} className="input" />
          </div>
          {isAdmin && (
            <div className="min-w-48">
              <label className="label" htmlFor="a-prof">Profissional</label>
              <select id="a-prof" name="professionalId" defaultValue={professionalId} className="input">
                <option value="">Todos</option>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="a-status">Situação</label>
            <select id="a-status" name="status" defaultValue={status} className="input">
              <option value="">Todas (sem cancelados)</option>
              {optionsOf(appointmentStatusLabels).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Filtrar</button>
          <div className="ml-auto flex items-center gap-2">
            <Link href={query({ from: today, to: today })} className="btn btn-outline btn-sm">Hoje</Link>
            <Link href={query({ from: addDays(today, -6), to: today })} className="btn btn-outline btn-sm">Últimos 7 dias</Link>
            <Link href={query({ from: today, to: addDays(today, 6) })} className="btn btn-outline btn-sm">Próximos 7 dias</Link>
          </div>
        </form>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nenhum atendimento neste período" description="Troque as datas ou a situação para ver outros atendimentos." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{oneDay ? "Horário" : "Data e horário"}</th><th>Paciente</th>
                  {isAdmin && <th>Profissional</th>}
                  <th>Serviço</th><th>Situação</th><th>Evolução</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const day = localParts(a.startsAt).date;
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap tabular-nums">
                        {!oneDay && <span className="mr-2 capitalize text-muted">{weekdayShort(day)} {formatDate(day).slice(0, 5)}</span>}
                        {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
                      </td>
                      <td>
                        <Link href={`/atendimento/${a.id}`} className="font-medium text-brand-800 hover:underline">{a.patient.name}</Link>
                      </td>
                      {isAdmin && <td>{a.professional.name}</td>}
                      <td>{a.service?.name ?? "Atendimento"}</td>
                      <td>
                        <Badge tone={appointmentTone(a.status)}>{appointmentStatusLabel(a.status, a.canceledBy)}</Badge>
                        {a.statusChangedBy && <span className="mt-0.5 block text-xs text-muted">por {a.statusChangedBy.name}</span>}
                      </td>
                      <td>
                        {a.evolution ? (
                          <>
                            <Badge tone="green">Registrada</Badge>
                            {a.evolution.author && <span className="mt-0.5 block text-xs text-muted">por {a.evolution.author.name}</span>}
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <Link href={`/atendimento/${a.id}`} className="text-sm text-brand-700 hover:underline">Atender</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > items.length && (
            <p className="mt-3 text-center text-sm text-muted">
              Mostrando os {items.length} primeiros de {total} atendimentos. Estreite o período para ver os demais.
            </p>
          )}
        </>
      )}
    </>
  );
}
