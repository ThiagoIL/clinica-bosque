import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  addDays, addMonths, formatDate, formatTime, isDateString, localParts, monthName, monthTitle,
  startOfMonth, startOfWeek, todayString, weekday, weekdayName, weekdayShort, zoned,
} from "@/lib/dates";
import { appointmentStatusLabels } from "@/lib/labels";
import { appointmentTone } from "@/lib/status";
import { Badge, Card, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { AppointmentActions } from "@/components/appointment-actions";
import { getAccess } from "@/lib/auth";
import { levelOf } from "@/lib/access";

export const metadata = { title: "Agenda" };

const HOUR_HEIGHT = 56;
type View = "day" | "week" | "month";

type Item = Prisma.AppointmentGetPayload<{
  include: {
    patient: { select: { name: true } };
    professional: { select: { name: true; color: true } };
    service: { select: { name: true } };
  };
}>;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayString();
  const view = (["day", "week", "month"] as const).find((v) => v === param(sp.view)) ?? "week";
  const date = isDateString(param(sp.date)) ? param(sp.date)! : today;
  const professionalId = param(sp.professionalId) ?? "";
  const patientId = param(sp.patientId) ?? "";
  const showCanceled = param(sp.canceled) === "1";
  const selectedId = param(sp.a);
  const canLaunch = levelOf(await getAccess(), "LANCAMENTOS") === "EDIT";

  // intervalo de dias exibido
  let days: string[];
  if (view === "day") days = [date];
  else if (view === "week") {
    const start = startOfWeek(date);
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  } else {
    const start = startOfWeek(startOfMonth(date));
    days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }
  const rangeStart = zoned(days[0], "00:00");
  const rangeEnd = zoned(addDays(days[days.length - 1], 1), "00:00");

  const [items, professionals, patients, selected] = await Promise.all([
    db.appointment.findMany({
      where: {
        startsAt: { gte: rangeStart, lt: rangeEnd },
        ...(professionalId ? { professionalId } : {}),
        ...(patientId ? { patientId } : {}),
        ...(showCanceled ? {} : { status: { not: "CANCELED" } }),
      },
      orderBy: { startsAt: "asc" },
      include: {
        patient: { select: { name: true } },
        professional: { select: { name: true, color: true } },
        service: { select: { name: true } },
      },
    }),
    db.professional.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    db.patient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    selectedId
      ? db.appointment.findUnique({
          where: { id: selectedId },
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            professional: { select: { name: true } },
            service: { select: { name: true } },
            engagement: { select: { id: true, number: true } },
          },
        })
      : null,
  ]);

  const byDay = new Map<string, Item[]>();
  for (const it of items) {
    const key = localParts(it.startsAt).date;
    byDay.set(key, [...(byDay.get(key) ?? []), it]);
  }

  // helpers de URL preservando filtros
  const build = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      view, date, professionalId, patientId, canceled: showCanceled ? "1" : undefined, ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/agenda?${q.toString()}`;
  };

  const prev = view === "month" ? addMonths(date, -1) : addDays(date, view === "week" ? -7 : -1);
  const next = view === "month" ? addMonths(date, 1) : addDays(date, view === "week" ? 7 : 1);

  const title =
    view === "month"
      ? monthTitle(date)
      : view === "day"
        ? `${weekdayName(date)}, ${formatDate(date)}`
        : `${formatDate(days[0])} a ${formatDate(days[6])}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={
          canLaunch ? (
            <LinkButton href={`/lancamentos/novo?date=${date}${professionalId ? `&professionalId=${professionalId}` : ""}${patientId ? `&patientId=${patientId}` : ""}`}>
              <Plus className="size-4" /> Novo lançamento
            </LinkButton>
          ) : undefined
        }
      />

      <div className="card mb-4 space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={build({ date: prev, a: undefined })} className="btn btn-outline btn-sm" aria-label="Anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href={build({ date: today, a: undefined })} className="btn btn-outline btn-sm">Hoje</Link>
            <Link href={build({ date: next, a: undefined })} className="btn btn-outline btn-sm" aria-label="Próximo">
              <ChevronRight className="size-4" />
            </Link>
            <h2 className="ml-2 text-base capitalize">{title}</h2>
          </div>
          <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">
            {(["day", "week", "month"] as const).map((v) => (
              <Link
                key={v}
                href={build({ view: v, a: undefined })}
                className={clsx(
                  "rounded-md px-3 py-1.5",
                  v === view ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
                )}
              >
                {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
              </Link>
            ))}
          </div>
        </div>

        <form action="/agenda" method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="view" value={view} />
          <div className="min-w-48">
            <label className="label" htmlFor="f-prof">Profissional</label>
            <select id="f-prof" name="professionalId" defaultValue={professionalId} className="input">
              <option value="">Todos</option>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="min-w-48">
            <label className="label" htmlFor="f-pat">Paciente</label>
            <select id="f-pat" name="patientId" defaultValue={patientId} className="input">
              <option value="">Todos</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-date">Ir para a data</label>
            <input id="f-date" type="date" name="date" defaultValue={date} className="input" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="canceled" value="1" defaultChecked={showCanceled} className="size-4 accent-brand-600" />
            Mostrar cancelados
          </label>
          <button type="submit" className="btn btn-primary">Aplicar</button>
          <Link href={`/agenda?view=${view}`} className="btn btn-ghost">Limpar</Link>
        </form>

        {professionals.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {professionals.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <Card
          className="mb-4 border-brand-300"
          title={`${selected.patient.name} · ${formatDate(localParts(selected.startsAt).date)} ${formatTime(selected.startsAt)}–${formatTime(selected.endsAt)}`}
          description={`${selected.service?.name ?? "Atendimento"} com ${selected.professional.name}`}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={appointmentTone(selected.status)}>{appointmentStatusLabels[selected.status]}</Badge>
              <Link href={build({ a: undefined })} className="btn btn-ghost btn-sm">Fechar</Link>
            </div>
          }
        >
          <div className="mb-4 flex flex-wrap gap-4 text-sm">
            <Link href={`/pacientes/${selected.patient.id}`} className="text-brand-700 hover:underline">Ver paciente</Link>
            {selected.engagement && (
              <Link href={`/lancamentos/${selected.engagement.id}`} className="text-brand-700 hover:underline">
                Lançamento #{selected.engagement.number}
              </Link>
            )}
          </div>
          <AppointmentActions appointment={selected} />
        </Card>
      )}

      {view === "month" ? (
        <MonthGrid days={days} month={date.slice(0, 7)} today={today} byDay={byDay} build={build} />
      ) : (
        <TimeGrid days={days} today={today} byDay={byDay} build={build} professionalId={professionalId} patientId={patientId} canLaunch={canLaunch} />
      )}

      {items.length === 0 && (
        <p className="mt-4 text-center text-sm text-muted">
          Nenhum atendimento em {view === "month" ? monthName(date) : "este período"} com os filtros atuais.
        </p>
      )}
    </>
  );
}

type Build = (over: Record<string, string | undefined>) => string;

function MonthGrid({
  days, month, today, byDay, build,
}: { days: string[]; month: string; today: string; byDay: Map<string, Item[]>; build: Build }) {
  const heads = days.slice(0, 7);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className="grid min-w-[44rem] grid-cols-7 border-b border-line bg-canvas text-xs font-medium uppercase tracking-wide text-muted">
        {heads.map((d) => (
          <div key={d} className="px-3 py-2">{weekdayShort(d)}</div>
        ))}
      </div>
      <div className="grid min-w-[44rem] grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const inMonth = d.startsWith(month);
          return (
            <div
              key={d}
              className={clsx("min-h-28 border-b border-r border-line p-1.5", !inMonth && "bg-canvas/60", weekday(d) === 6 && "border-r-0")}
            >
              <Link
                href={build({ view: "day", date: d, a: undefined })}
                className={clsx(
                  "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs",
                  d === today ? "bg-brand-600 font-semibold text-white" : inMonth ? "hover:bg-brand-50" : "text-muted",
                )}
              >
                {Number(d.slice(8))}
              </Link>
              <ul className="space-y-0.5">
                {list.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={build({ a: a.id, view: "month" })}
                      className={clsx(
                        "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-brand-50",
                        a.status === "CANCELED" && "line-through opacity-60",
                      )}
                      title={`${formatTime(a.startsAt)} ${a.patient.name} — ${a.professional.name}`}
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: a.professional.color }} />
                      <span className="tabular-nums text-muted">{formatTime(a.startsAt)}</span>
                      <span className="truncate">{a.patient.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {list.length > 3 && (
                <Link
                  href={build({ view: "day", date: d, a: undefined })}
                  className="mt-0.5 block px-1 text-[11px] font-medium text-brand-700 hover:underline"
                >
                  +{list.length - 3} mais
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Distribui eventos sobrepostos em colunas lado a lado. */
function layoutLanes(list: Item[]) {
  const sorted = [...list].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const placed: { item: Item; lane: number; lanes: number }[] = [];
  let cluster: { item: Item; lane: number }[] = [];
  let clusterEnd = 0;
  const laneEnds: number[] = [];

  const flush = () => {
    const lanes = laneEnds.length || 1;
    for (const c of cluster) placed.push({ ...c, lanes });
    cluster = [];
    laneEnds.length = 0;
  };

  for (const item of sorted) {
    const start = item.startsAt.getTime();
    if (cluster.length && start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = item.endsAt.getTime();
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.endsAt.getTime());
  }
  flush();
  return placed;
}

function TimeGrid({
  days, today, byDay, build, professionalId, patientId, canLaunch,
}: {
  canLaunch: boolean;
  days: string[];
  today: string;
  byDay: Map<string, Item[]>;
  build: Build;
  professionalId: string;
  patientId: string;
}) {
  const all = days.flatMap((d) => byDay.get(d) ?? []);
  let startHour = 7;
  let endHour = 20;
  for (const a of all) {
    const s = localParts(a.startsAt).time;
    const e = localParts(a.endsAt).time;
    startHour = Math.min(startHour, Number(s.slice(0, 2)));
    endHour = Math.max(endHour, Number(e.slice(0, 2)) + (Number(e.slice(3)) > 0 ? 1 : 0));
  }
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const cols = days.length;

  const minutesOf = (d: Date) => {
    const t = localParts(d).time;
    return Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  };

  const newHref = (date: string, hour: number) =>
    `/lancamentos/novo?date=${date}&time=${String(hour).padStart(2, "0")}:00${professionalId ? `&professionalId=${professionalId}` : ""}${patientId ? `&patientId=${patientId}` : ""}`;

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className={clsx(cols === 7 ? "min-w-[56rem]" : "min-w-[24rem]")}>
        <div className="grid border-b border-line bg-canvas" style={{ gridTemplateColumns: `3.5rem repeat(${cols}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => (
            <Link
              key={d}
              href={build({ view: "day", date: d, a: undefined })}
              className={clsx("border-l border-line px-2 py-2 text-center text-xs", d === today && "bg-brand-50")}
            >
              <span className="block uppercase tracking-wide text-muted">{weekdayShort(d)}</span>
              <span className={clsx("text-sm font-semibold", d === today && "text-brand-700")}>{Number(d.slice(8))}</span>
            </Link>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${cols}, minmax(0, 1fr))` }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="pr-2 text-right text-[11px] tabular-nums text-muted" style={{ height: HOUR_HEIGHT }}>
                <span className="relative -top-2">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {days.map((d) => {
            const placed = layoutLanes(byDay.get(d) ?? []);
            return (
              <div key={d} className={clsx("relative border-l border-line", d === today && "bg-brand-50/40")} style={{ height: gridHeight }}>
                {canLaunch && hours.map((h, i) => (
                  <Link
                    key={h}
                    href={newHref(d, h)}
                    aria-label={`Novo lançamento em ${formatDate(d)} às ${h}:00`}
                    className="absolute inset-x-0 border-t border-line/70 hover:bg-brand-100/40"
                    style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}
                {placed.map(({ item: a, lane, lanes }) => {
                  const top = ((minutesOf(a.startsAt) - startHour * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(((minutesOf(a.endsAt) - minutesOf(a.startsAt)) / 60) * HOUR_HEIGHT, 24);
                  return (
                    <Link
                      key={a.id}
                      href={build({ a: a.id })}
                      className={clsx(
                        "absolute overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-[11px] leading-tight shadow-xs transition hover:z-10 hover:shadow-md",
                        a.status === "CANCELED" && "line-through opacity-60",
                        a.status === "COMPLETED" && "opacity-80",
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(lane / lanes) * 100}% + 1px)`,
                        width: `calc(${100 / lanes}% - 3px)`,
                        borderColor: a.professional.color,
                        background: `${a.professional.color}26`,
                      }}
                      title={`${a.patient.name} — ${a.professional.name} (${appointmentStatusLabels[a.status]})`}
                    >
                      <span className="block truncate font-semibold">
                        {formatTime(a.startsAt)} {a.patient.name}
                      </span>
                      <span className="block truncate text-muted">
                        {a.service?.name ?? "Atendimento"} · {a.professional.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
