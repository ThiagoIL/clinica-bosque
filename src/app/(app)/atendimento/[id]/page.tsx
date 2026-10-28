import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatTime, localParts } from "@/lib/dates";
import { appointmentStatusLabel } from "@/lib/labels";
import { appointmentTone } from "@/lib/status";
import { ActionForm, FormActions, SubmitButton, TextareaField } from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { AppointmentActions } from "@/components/appointment-actions";
import { saveEvolution } from "../actions";

export const metadata = { title: "Atendimento" };

export default async function AttendanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [appointment, me] = await Promise.all([
    db.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true } },
        professional: { select: { name: true } },
        service: { select: { name: true } },
        evolution: true,
      },
    }),
    db.user.findUnique({ where: { id: user.id }, select: { role: true, professionalId: true } }),
  ]);
  if (!appointment) notFound();

  if (me?.role !== "ADMIN" && me?.professionalId !== appointment.professionalId) {
    return (
      <>
        <PageHeader title="Atendimento" back={{ href: "/atendimento", label: "Atendimento" }} />
        <EmptyState
          title="Este atendimento é de outro profissional"
          description="Na tela Atendimento você vê e registra apenas os seus atendimentos."
          action={<LinkButton href="/atendimento">Meus atendimentos</LinkButton>}
        />
      </>
    );
  }

  const previous = await db.evolution.findMany({
    where: { patientId: appointment.patientId, NOT: { appointmentId: appointment.id } },
    orderBy: { appointment: { startsAt: "desc" } },
    take: 8,
    include: {
      professional: { select: { name: true } },
      appointment: { select: { startsAt: true, service: { select: { name: true } } } },
    },
  });

  const day = localParts(appointment.startsAt).date;

  return (
    <>
      <PageHeader
        title={appointment.patient.name}
        description={`${appointment.service?.name ?? "Atendimento"} · ${formatDate(day)} ${formatTime(appointment.startsAt)}–${formatTime(appointment.endsAt)} · ${appointment.professional.name}`}
        back={{ href: `/atendimento?date=${day}`, label: "Atendimento" }}
        actions={
          <>
            <Badge tone={appointmentTone(appointment.status)}>
              {appointmentStatusLabel(appointment.status, appointment.canceledBy)}
            </Badge>
            <LinkButton href={`/pacientes/${appointment.patient.id}`} variant="outline">Ir para o paciente</LinkButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card title="Evolução deste atendimento" description="Registre o que foi feito e observado. Fica no histórico do paciente, visível a todos os profissionais.">
            <ActionForm action={saveEvolution}>
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <TextareaField name="content" label="Anotações / evolução" rows={12} required defaultValue={appointment.evolution?.content} />
              <FormActions>
                <SubmitButton>{appointment.evolution ? "Salvar evolução" : "Registrar evolução"}</SubmitButton>
                {appointment.evolution && (
                  <span className="text-xs text-muted">Última alteração em {formatDateTime(appointment.evolution.updatedAt)}</span>
                )}
              </FormActions>
            </ActionForm>
          </Card>

          <Card title="Situação do atendimento">
            <AppointmentActions appointment={appointment} />
          </Card>
        </div>

        <Card
          title="Evoluções anteriores"
          description="Do mesmo paciente, de todos os profissionais"
          actions={<Link href={`/pacientes/${appointment.patient.id}?tab=sessoes`} className="text-sm text-brand-700 hover:underline">Ver todas</Link>}
        >
          {previous.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma evolução registrada antes deste atendimento.</p>
          ) : (
            <ul className="space-y-3">
              {previous.map((e) => (
                <li key={e.id} className="rounded-lg border border-line p-3 text-sm">
                  <p className="text-xs text-muted">
                    {formatDateTime(e.appointment.startsAt)} · {e.professional.name}
                    {e.appointment.service ? ` · ${e.appointment.service.name}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{e.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
