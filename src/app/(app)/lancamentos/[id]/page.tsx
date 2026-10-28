import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { WEEKDAY_OPTIONS, appointmentStatusLabel, attendanceKindLabels, billingModeLabels, engagementStatusLabels, recurrenceLabels } from "@/lib/labels";
import { appointmentTone, engagementTone, entryDisplayStatus } from "@/lib/status";
import { ActionForm, ConfirmSubmit } from "@/components/ui/form-kit";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { AppointmentActions } from "@/components/appointment-actions";
import { cancelEngagement, deleteEngagement } from "../actions";
import { getAccess } from "@/lib/auth";
import { levelOf } from "@/lib/access";

export const metadata = { title: "Lançamento" };

export default async function EngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const engagement = await db.engagement.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, name: true } },
      professional: { select: { id: true, name: true } },
      service: { select: { name: true } },
      healthPlan: { select: { name: true } },
      appointments: { orderBy: { startsAt: "asc" } },
      entries: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!engagement) notFound();

  const canFinance = levelOf(await getAccess(), "FINANCEIRO") !== "NONE";
  const paid = engagement.entries.filter((e) => e.status === "PAID").reduce((s, e) => s + (e.paidAmountCents ?? 0), 0);
  const open = engagement.entries.filter((e) => e.status === "PENDING").reduce((s, e) => s + e.amountCents, 0);

  return (
    <>
      <PageHeader
        title={`Lançamento #${engagement.number}`}
        description={`${engagement.service.name} · ${engagement.patient.name}`}
        back={{ href: "/lancamentos", label: "Lançamentos" }}
        actions={
          <>
            <Badge tone={engagementTone(engagement.status)}>{engagementStatusLabels[engagement.status]}</Badge>
            {engagement.status !== "CANCELED" && (
              <LinkButton href={`/lancamentos/${engagement.id}/editar`} variant="outline">Editar</LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card title="Resumo">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Paciente">
              <Link href={`/pacientes/${engagement.patient.id}`} className="text-brand-700 hover:underline">
                {engagement.patient.name}
              </Link>
            </Info>
            <Info label="Profissional">{engagement.professional.name}</Info>
            <Info label="Serviço">{engagement.service.name}</Info>
            <Info label="Tipo">
              <Badge tone={engagement.kind === "RETURN" ? "amber" : "gray"}>{attendanceKindLabels[engagement.kind]}</Badge>
            </Info>
            <Info label="Plano de saúde">{engagement.healthPlan?.name ?? "—"}</Info>
            <Info label="Repetição">
              {recurrenceLabels[engagement.recurrence].split(" (")[0]}
              {engagement.weekdays.length > 0 && (
                <span className="block text-xs text-muted">
                  {WEEKDAY_OPTIONS.filter((d) => engagement.weekdays.includes(d.value)).map((d) => d.label).join(", ")}
                </span>
              )}
              {engagement.untilDate && (
                <span className="block text-xs text-muted">até {formatDate(engagement.untilDate)}</span>
              )}
            </Info>
            <Info label="Sessões">{engagement.quantity} × {formatMoney(engagement.unitPriceCents)}</Info>
            <Info label="Desconto">{formatMoney(engagement.discountCents)}</Info>
            <Info label="Total"><strong>{formatMoney(engagement.totalCents)}</strong></Info>
            <Info label="Cobrança">{billingModeLabels[engagement.billingMode]}</Info>
          </dl>
          {engagement.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{engagement.notes}</p>}
        </Card>

        {canFinance && (
        <Card title="Financeiro">
          <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <Info label="Recebido"><span className="font-semibold text-brand-700">{formatMoney(paid)}</span></Info>
            <Info label="Em aberto"><span className="font-semibold text-amber-600">{formatMoney(open)}</span></Info>
          </div>
          <ul className="divide-y divide-line text-sm">
            {engagement.entries.map((e) => {
              const st = entryDisplayStatus(e);
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/financeiro/receber/${e.id}`} className="min-w-0 hover:underline">
                    <p className="truncate">{e.description}</p>
                    <p className="text-xs text-muted">Vence em {formatDate(e.dueDate)}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums">{formatMoney(e.amountCents)}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                </li>
              );
            })}
            {engagement.entries.length === 0 && <li className="py-2 text-muted">Sem cobranças geradas.</li>}
          </ul>
        </Card>
        )}
      </div>

      <Card title="Atendimentos" padded={false}>
        <ul className="divide-y divide-line">
          {engagement.appointments.map((a) => (
            <li key={a.id} className="px-5 py-3">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {a.sequence ? `Sessão ${a.sequence}/${engagement.quantity} · ` : ""}
                    {formatDateTime(a.startsAt)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-muted">{formatMoney(a.priceCents)}</span>
                    <Badge tone={appointmentTone(a.status)}>{appointmentStatusLabel(a.status, a.canceledBy)}</Badge>
                  </span>
                </summary>
                <div className="mt-3 rounded-lg bg-canvas p-4">
                  <AppointmentActions appointment={a} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {engagement.status !== "CANCELED" && (
          <ActionForm action={cancelEngagement}>
            <input type="hidden" name="id" value={engagement.id} />
            <ConfirmSubmit message="Cancelar o lançamento? Os atendimentos futuros e as cobranças em aberto serão cancelados.">
              Cancelar lançamento
            </ConfirmSubmit>
          </ActionForm>
        )}
        <ActionForm action={deleteEngagement}>
          <input type="hidden" name="id" value={engagement.id} />
          <input type="hidden" name="redirect" value="1" />
          <ConfirmSubmit
            variant="outline"
            message={`Excluir o lançamento #${engagement.number}? Os ${engagement.appointments.length} atendimento(s) e as cobranças dele serão removidos. Para manter o histórico, use “Cancelar lançamento”.`}
          >
            Excluir lançamento
          </ConfirmSubmit>
        </ActionForm>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
