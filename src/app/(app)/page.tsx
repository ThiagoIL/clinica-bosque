import Link from "next/link";
import { db } from "@/lib/db";
import {
  addDays, dateOnly, endOfMonth, formatDate, formatTime, monthTitle, startOfMonth, todayString, weekdayName, zoned,
} from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { appointmentStatusLabels } from "@/lib/labels";
import { appointmentTone } from "@/lib/status";
import { requireUser } from "@/lib/auth";
import { Badge, Card, LinkButton, PageHeader, Stat } from "@/components/ui/primitives";

export const metadata = { title: "Início" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayString();
  const todayDate = dateOnly(today);
  const monthStart = dateOnly(startOfMonth(today));
  const monthEnd = dateOnly(endOfMonth(today));
  const in7 = dateOnly(addDays(today, 7));

  const sum = (r: { _sum: { amountCents: number | null } }) => r._sum.amountCents ?? 0;

  const [
    appointmentsToday, upcomingCount, patientCount,
    receivedMonth, paidMonth, receivableOverdue, receivableWeek, payableOverdue, payableWeek, stockItems,
  ] = await Promise.all([
    db.appointment.findMany({
      where: { startsAt: { gte: zoned(today, "00:00"), lt: zoned(addDays(today, 1), "00:00") }, status: { not: "CANCELED" } },
      orderBy: { startsAt: "asc" },
      include: {
        patient: { select: { name: true } },
        professional: { select: { name: true, color: true } },
        service: { select: { name: true } },
      },
    }),
    db.appointment.count({
      where: { startsAt: { gte: zoned(addDays(today, 1), "00:00"), lt: zoned(addDays(today, 8), "00:00") }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    }),
    db.patient.count({ where: { active: true } }),
    db.financialEntry.aggregate({
      where: { kind: "INCOME", status: "PAID", paidOn: { gte: monthStart, lte: monthEnd } },
      _sum: { paidAmountCents: true },
    }),
    db.financialEntry.aggregate({
      where: { kind: "EXPENSE", status: "PAID", paidOn: { gte: monthStart, lte: monthEnd } },
      _sum: { paidAmountCents: true },
    }),
    db.financialEntry.aggregate({ where: { kind: "INCOME", status: "PENDING", dueDate: { lt: todayDate } }, _sum: { amountCents: true } }),
    db.financialEntry.aggregate({ where: { kind: "INCOME", status: "PENDING", dueDate: { gte: todayDate, lte: in7 } }, _sum: { amountCents: true } }),
    db.financialEntry.aggregate({ where: { kind: "EXPENSE", status: "PENDING", dueDate: { lt: todayDate } }, _sum: { amountCents: true } }),
    db.financialEntry.aggregate({ where: { kind: "EXPENSE", status: "PENDING", dueDate: { gte: todayDate, lte: in7 } }, _sum: { amountCents: true } }),
    db.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const received = receivedMonth._sum.paidAmountCents ?? 0;
  const spent = paidMonth._sum.paidAmountCents ?? 0;
  const lowStock = stockItems.filter((i) => i.quantity <= i.minQuantity);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description={`${weekdayName(today)}, ${formatDate(today)}`}
        actions={<LinkButton href="/lancamentos/novo">Novo lançamento</LinkButton>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Atendimentos hoje" value={appointmentsToday.length} href="/agenda?view=day" />
        <Stat label="Próximos 7 dias" value={upcomingCount} hint="agendados / confirmados" href="/agenda" />
        <Stat label="Pacientes ativos" value={patientCount} href="/pacientes" />
        <Stat label="Itens para repor" value={lowStock.length} tone={lowStock.length ? "bad" : "default"} href="/estoque?low=1" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`Recebido em ${monthTitle(today).split(" de ")[0]}`} value={formatMoney(received)} tone="good" href="/financeiro/extrato" />
        <Stat label={`Pago em ${monthTitle(today).split(" de ")[0]}`} value={formatMoney(spent)} href="/financeiro/extrato" />
        <Stat
          label="A receber"
          value={formatMoney(sum(receivableOverdue) + sum(receivableWeek))}
          hint={`${formatMoney(sum(receivableOverdue))} vencido · ${formatMoney(sum(receivableWeek))} em 7 dias`}
          tone={sum(receivableOverdue) > 0 ? "warn" : "default"}
          href="/financeiro/receber"
        />
        <Stat
          label="A pagar"
          value={formatMoney(sum(payableOverdue) + sum(payableWeek))}
          hint={`${formatMoney(sum(payableOverdue))} vencido · ${formatMoney(sum(payableWeek))} em 7 dias`}
          tone={sum(payableOverdue) > 0 ? "bad" : "default"}
          href="/financeiro/pagar"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Agenda de hoje" padded={false} actions={<Link href="/agenda?view=day" className="text-sm text-brand-700 hover:underline">Abrir agenda</Link>}>
          {appointmentsToday.length === 0 ? (
            <p className="p-5 text-sm text-muted">Nenhum atendimento agendado para hoje.</p>
          ) : (
            <ul className="divide-y divide-line">
              {appointmentsToday.map((a) => (
                <li key={a.id}>
                  <Link href={`/agenda?view=day&a=${a.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-brand-50/50">
                    <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{formatTime(a.startsAt)}</span>
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: a.professional.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.patient.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {a.service?.name ?? "Atendimento"} · {a.professional.name}
                      </span>
                    </span>
                    <Badge tone={appointmentTone(a.status)}>{appointmentStatusLabels[a.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Estoque para repor" padded={false} actions={<Link href="/estoque?low=1" className="text-sm text-brand-700 hover:underline">Ver estoque</Link>}>
          {lowStock.length === 0 ? (
            <p className="p-5 text-sm text-muted">Nenhum item abaixo do mínimo.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.slice(0, 8).map((i) => (
                <li key={i.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="tabular-nums text-red-600">
                    {i.quantity} / {i.minQuantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
