import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ageFromBirth, formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/cpf";
import { appointmentStatusLabels } from "@/lib/labels";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { ActionForm, ConfirmSubmit, FormActions, SubmitButton, TextareaField } from "@/components/ui/form-kit";
import { PatientForm } from "../patient-form";
import { addPatientNote, deletePatient, deletePatientNote } from "../actions";
import { appointmentTone } from "@/lib/status";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id }, select: { name: true } });
  return { title: patient?.name ?? "Paciente" };
}

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id }, include: { healthPlan: true } });
  if (!patient) notFound();

  const [plans, notes, appointments, openEntries] = await Promise.all([
    db.healthPlan.findMany({
      where: { OR: [{ active: true }, { id: patient.healthPlanId ?? "" }] },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db.patientNote.findMany({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
      take: 50,
    }),
    db.appointment.findMany({
      where: { patientId: id },
      orderBy: { startsAt: "desc" },
      take: 10,
      include: { professional: { select: { name: true } }, service: { select: { name: true } } },
    }),
    db.financialEntry.findMany({
      where: { patientId: id, kind: "INCOME", status: "PENDING" },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const age = ageFromBirth(patient.birthDate);

  return (
    <>
      <PageHeader
        title={patient.name}
        description={[age != null ? `${age} anos` : null, formatPhone(patient.phone) || null, patient.healthPlan?.name]
          .filter(Boolean)
          .join(" · ")}
        back={{ href: "/pacientes", label: "Pacientes" }}
        actions={
          <>
            {!patient.active && <Badge>Inativo</Badge>}
            <LinkButton href={`/lancamentos/novo?patientId=${patient.id}`}>Novo lançamento</LinkButton>
            <LinkButton href={`/agenda?patientId=${patient.id}`} variant="outline">Ver agenda</LinkButton>
          </>
        }
      />

      <PatientForm patient={patient} plans={plans} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Anotações" description="Histórico de observações sobre o paciente">
          <ActionForm action={addPatientNote} className="mb-5" resetOnSuccess>
            <input type="hidden" name="patientId" value={patient.id} />
            <TextareaField name="content" label="Nova anotação" rows={3} />
            <FormActions>
              <SubmitButton>Registrar anotação</SubmitButton>
            </FormActions>
          </ActionForm>
          {notes.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma anotação registrada.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-line p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>
                      {formatDateTime(n.createdAt)}
                      {n.author ? ` · ${n.author.name}` : ""}
                    </span>
                    <ActionForm action={deletePatientNote} hideMessages>
                      <input type="hidden" name="id" value={n.id} />
                      <ConfirmSubmit message="Excluir esta anotação?" variant="outline">Excluir</ConfirmSubmit>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Últimos atendimentos" padded={false}>
            {appointments.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Nenhum atendimento" />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{formatDateTime(a.startsAt)}</p>
                      <p className="text-xs text-muted">
                        {a.service?.name ?? "Atendimento"} · {a.professional.name}
                      </p>
                    </div>
                    <Badge tone={appointmentTone(a.status)}>{appointmentStatusLabels[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Cobranças em aberto" padded={false}>
            {openEntries.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nenhuma cobrança em aberto.</p>
            ) : (
              <ul className="divide-y divide-line">
                {openEntries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <Link href={`/financeiro/receber/${e.id}`} className="hover:underline">
                      <p className="font-medium">{e.description}</p>
                      <p className="text-xs text-muted">Vence em {formatDate(e.dueDate)}</p>
                    </Link>
                    <span className="font-medium tabular-nums">{formatMoney(e.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Zona de risco">
            <p className="mb-3 text-sm text-muted">
              Só é possível excluir pacientes sem atendimentos ou lançamentos. Caso contrário, desative o cadastro.
            </p>
            <ActionForm action={deletePatient}>
              <input type="hidden" name="id" value={patient.id} />
              <ConfirmSubmit message="Excluir definitivamente este paciente?">Excluir paciente</ConfirmSubmit>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
