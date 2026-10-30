import Link from "next/link";
import { db } from "@/lib/db";
import {
  addDays, dateOnly, endOfMonth, formatDate, formatTime, monthTitle, startOfMonth, todayString, weekdayName, zoned,
} from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { appointmentStatusLabel } from "@/lib/labels";
import { appointmentColors, appointmentTone } from "@/lib/status";
import { getAccess, requireUser } from "@/lib/auth";
import { levelOf } from "@/lib/access";
import type { ModuleKey } from "@/lib/modules";
import { EXPIRING_DAYS } from "@/lib/contracts";
import { Badge, Card, LinkButton, PageHeader, Stat, param } from "@/components/ui/primitives";

export const metadata = { title: "Início" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const access = await getAccess();
  const can = (m: ModuleKey) => levelOf(access, m) !== "NONE";
  const denied = param((await searchParams).acesso) === "negado";

  const today = todayString();
  const todayDate = dateOnly(today);
  const monthStart = dateOnly(startOfMonth(today));
  const monthEnd = dateOnly(endOfMonth(today));
  const in7 = dateOnly(addDays(today, 7));
  const sum = (r: { _sum: { amountCents: number | null } }) => r._sum.amountCents ?? 0;

  // Só consulta o que o usuário pode ver.
  const [appointmentsToday, upcomingCount, patientCount, finance, stockItems, contractAlerts] = await Promise.all([
    can("AGENDA")
      ? db.appointment.findMany({
          where: { startsAt: { gte: zoned(today, "00:00"), lt: zoned(addDays(today, 1), "00:00") }, status: { not: "CANCELED" } },
          orderBy: { startsAt: "asc" },
          include: {
            patient: { select: { name: true } },
            professional: { select: { name: true } },
            service: { select: { name: true } },
          },
        })
      : [],
    can("AGENDA")
      ? db.appointment.count({
          where: { startsAt: { gte: zoned(addDays(today, 1), "00:00"), lt: zoned(addDays(today, 8), "00:00") }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
        })
      : 0,
    can("PACIENTES") ? db.patient.count({ where: { active: true } }) : 0,
    can("FINANCEIRO")
      ? Promise.all([
          db.financialEntry.aggregate({ where: { kind: "INCOME", status: "PAID", paidOn: { gte: monthStart, lte: monthEnd } }, _sum: { paidAmountCents: true } }),
          db.financialEntry.aggregate({ where: { kind: "EXPENSE", status: "PAID", paidOn: { gte: monthStart, lte: monthEnd } }, _sum: { paidAmountCents: true } }),
          db.financialEntry.aggregate({ where: { kind: "INCOME", status: "PENDING", dueDate: { lt: todayDate } }, _sum: { amountCents: true } }),
          db.financialEntry.aggregate({ where: { kind: "INCOME", status: "PENDING", dueDate: { gte: todayDate, lte: in7 } }, _sum: { amountCents: true } }),
          db.financialEntry.aggregate({ where: { kind: "EXPENSE", status: "PENDING", dueDate: { lt: todayDate } }, _sum: { amountCents: true } }),
          db.financialEntry.aggregate({ where: { kind: "EXPENSE", status: "PENDING", dueDate: { gte: todayDate, lte: in7 } }, _sum: { amountCents: true } }),
        ])
      : null,
    can("ESTOQUE") ? db.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [],
    // contratos ativos que vencem em até 30 dias ou já venceram sem serem encerrados
    can("CONTRATOS")
      ? db.contract.count({ where: { status: "ACTIVE", endDate: { lte: dateOnly(addDays(today, EXPIRING_DAYS)) } } })
      : 0,
  ]);

  const lowStock = stockItems.filter((i) => i.quantity <= i.minQuantity);
  const monthName = monthTitle(today).split(" de ")[0];
  const hasAnyModule = (["AGENDA", "PACIENTES", "FINANCEIRO", "ESTOQUE", "CONTRATOS"] as ModuleKey[]).some(can);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description={`${weekdayName(today)}, ${formatDate(today)}`}
        actions={can("LANCAMENTOS") && levelOf(access, "LANCAMENTOS") === "EDIT" ? <LinkButton href="/lancamentos/novo">Novo lançamento</LinkButton> : undefined}
      />

      {denied && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Você não tem acesso a essa área. Se precisar, peça ao administrador da empresa para ajustar o seu perfil.
        </p>
      )}

      {!hasAnyModule && !can("LANCAMENTOS") && !can("PROFISSIONAIS") && !can("CADASTROS") && (
        <p className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          Seu usuário ainda não tem acesso a nenhum módulo. Peça ao administrador da empresa para definir o seu perfil de acesso.
        </p>
      )}

      {(can("AGENDA") || can("PACIENTES") || can("ESTOQUE") || can("CONTRATOS")) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {can("AGENDA") && (
            <>
              <Stat label="Atendimentos hoje" value={appointmentsToday.length} href="/agenda?view=day" />
              <Stat label="Próximos 7 dias" value={upcomingCount} hint="agendados / confirmados" href="/agenda" />
            </>
          )}
          {can("PACIENTES") && <Stat label="Pacientes ativos" value={patientCount} href="/pacientes" />}
          {can("CONTRATOS") && (
            <Stat
              label="Contratos a vencer"
              value={contractAlerts}
              hint={`vencem em ${EXPIRING_DAYS} dias ou já vencidos`}
              tone={contractAlerts ? "warn" : "default"}
              href="/contratos?status=attention"
            />
          )}
          {can("ESTOQUE") && (
            <Stat label="Itens para repor" value={lowStock.length} tone={lowStock.length ? "bad" : "default"} href="/estoque?low=1" />
          )}
        </div>
      )}

      {finance && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={`Recebido em ${monthName}`} value={formatMoney(finance[0]._sum.paidAmountCents ?? 0)} tone="good" href="/financeiro/extrato" />
          <Stat label={`Pago em ${monthName}`} value={formatMoney(finance[1]._sum.paidAmountCents ?? 0)} href="/financeiro/extrato" />
          <Stat
            label="A receber"
            value={formatMoney(sum(finance[2]) + sum(finance[3]))}
            hint={`${formatMoney(sum(finance[2]))} vencido · ${formatMoney(sum(finance[3]))} em 7 dias`}
            tone={sum(finance[2]) > 0 ? "warn" : "default"}
            href="/financeiro/receber"
          />
          <Stat
            label="A pagar"
            value={formatMoney(sum(finance[4]) + sum(finance[5]))}
            hint={`${formatMoney(sum(finance[4]))} vencido · ${formatMoney(sum(finance[5]))} em 7 dias`}
            tone={sum(finance[4]) > 0 ? "bad" : "default"}
            href="/financeiro/pagar"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {can("AGENDA") && (
          <Card title="Agenda de hoje" padded={false} actions={<Link href="/agenda?view=day" className="text-sm text-brand-700 hover:underline">Abrir agenda</Link>}>
            {appointmentsToday.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nenhum atendimento agendado para hoje.</p>
            ) : (
              <ul className="divide-y divide-line">
                {appointmentsToday.map((a) => (
                  <li key={a.id}>
                    <Link href={`/agenda?view=day&date=${todayString()}&a=${a.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-brand-50/50">
                      <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{formatTime(a.startsAt)}</span>
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: appointmentColors[a.status] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.patient.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {a.service?.name ?? "Atendimento"} · {a.professional.name}
                        </span>
                      </span>
                      <Badge tone={appointmentTone(a.status)}>{appointmentStatusLabel(a.status, a.canceledBy)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {can("ESTOQUE") && (
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
        )}
      </div>
    </>
  );
}
