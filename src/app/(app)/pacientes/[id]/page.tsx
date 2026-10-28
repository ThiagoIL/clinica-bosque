import { notFound } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { Download, FileText } from "lucide-react";
import type { Patient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ageFromBirth, formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/cpf";
import { FILE_ACCEPT, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, formatBytes } from "@/lib/contracts";
import { appointmentStatusLabel, billingModeLabels, optionsOf, paymentMethodLabels } from "@/lib/labels";
import { appointmentTone, engagementTone, entryDisplayStatus } from "@/lib/status";
import { Badge, Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import {
  ActionForm, ConfirmSubmit, FileField, FormActions, FormGrid, MaskedField, SelectField, SubmitButton, TextField,
  TextareaField,
} from "@/components/ui/form-kit";
import { PatientForm } from "../patient-form";
import { AnamnesisForm } from "../anamnesis-form";
import { PatientPhotoButton } from "../photo-button";
import { deletePatient, deletePatientFile, savePatientFinancial, uploadPatientFiles } from "../actions";
import { engagementStatusLabels } from "@/lib/labels";
import { getAccess } from "@/lib/auth";
import { levelOf } from "@/lib/access";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id }, select: { name: true } });
  return { title: patient?.name ?? "Paciente" };
}

const TABS = [
  { id: "cadastro", label: "Cadastro" },
  { id: "anamnese", label: "Anamnese" },
  { id: "sessoes", label: "Sessões" },
  { id: "financeiro", label: "Financeiro" },
  { id: "documentos", label: "Documentos" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DUE_DAYS = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }));

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabId = TABS.find((t) => t.id === param(sp.tab))?.id ?? "cadastro";

  const patient = await db.patient.findUnique({ where: { id }, include: { healthPlan: true } });
  if (!patient) notFound();

  const access = await getAccess();
  const canLaunch = levelOf(access, "LANCAMENTOS") === "EDIT";
  const canAgenda = levelOf(access, "AGENDA") !== "NONE";
  const canFinance = levelOf(access, "FINANCEIRO") !== "NONE";

  const [counts, next, photo] = await Promise.all([
    db.appointment.groupBy({ by: ["status"], where: { patientId: id }, _count: { _all: true } }),
    db.appointment.findFirst({
      where: { patientId: id, startsAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true },
    }),
    db.patientPhoto.findUnique({ where: { patientId: id }, select: { updatedAt: true } }),
  ]);
  const countOf = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
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
            {canLaunch && <LinkButton href={`/lancamentos/novo?patientId=${patient.id}`}>Novo lançamento</LinkButton>}
            {canAgenda && <LinkButton href={`/agenda?patientId=${patient.id}`} variant="outline">Ver agenda</LinkButton>}
          </>
        }
      />

      <div className="card mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
        <PatientPhotoButton patientId={patient.id} hasPhoto={!!photo} version={photo?.updatedAt.getTime() ?? 0} />
        <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Próxima sessão" value={next ? formatDateTime(next.startsAt) : "—"} />
          <Stat label="Sessões presentes" value={countOf("COMPLETED")} tone="text-brand-700" />
          <Stat label="Sessões ausentes" value={countOf("NO_SHOW")} tone="text-red-600" />
          <Stat label="Sessões canceladas" value={countOf("CANCELED")} tone="text-muted" />
        </dl>
      </div>

      <nav role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/pacientes/${id}?tab=${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "cadastro" && <RegistrationTab patient={patient} />}
      {tab === "anamnese" && <AnamnesisForm patient={patient} />}
      {tab === "sessoes" && <SessionsTab patientId={id} />}
      {tab === "financeiro" && <FinancialTab patientId={id} canFinance={canFinance} />}
      {tab === "documentos" && <DocumentsTab patientId={id} />}
    </>
  );
}

// ───────────────────────── Cadastro ─────────────────────────

async function RegistrationTab({ patient }: { patient: Patient }) {
  const plans = await db.healthPlan.findMany({
    where: { OR: [{ active: true }, { id: patient.healthPlanId ?? "" }] },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return (
    <div className="space-y-6">
      <PatientForm patient={patient} plans={plans} />
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
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg bg-canvas px-4 py-3 text-center">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={clsx("mt-1 text-lg font-semibold tabular-nums", tone)}>{value}</dd>
    </div>
  );
}

// ───────────────────────── Sessões ─────────────────────────

async function SessionsTab({ patientId }: { patientId: string }) {
  const [appointments, evolutions, legacyNotes] = await Promise.all([
    db.appointment.findMany({
      where: { patientId },
      orderBy: { startsAt: "desc" },
      take: 100,
      include: {
        professional: { select: { name: true } },
        service: { select: { name: true } },
        evolution: { select: { id: true } },
      },
    }),
    db.evolution.findMany({
      where: { patientId },
      orderBy: { appointment: { startsAt: "desc" } },
      take: 100,
      include: {
        professional: { select: { name: true } },
        appointment: { select: { startsAt: true, service: { select: { name: true } } } },
      },
    }),
    db.patientNote.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Sessões" description={`${appointments.length} atendimento(s) — mais recentes primeiro`} padded={false}>
        {appointments.length === 0 ? (
          <div className="p-5"><EmptyState title="Nenhum atendimento" /></div>
        ) : (
          <ul className="divide-y divide-line">
            {appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{formatDateTime(a.startsAt)}</p>
                  <p className="text-xs text-muted">
                    {a.service?.name ?? "Atendimento"} · {a.professional.name}
                    {a.evolution ? " · evolução registrada" : ""}
                  </p>
                </div>
                <Badge tone={appointmentTone(a.status)}>{appointmentStatusLabel(a.status, a.canceledBy)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-6">
        <Card title="Evoluções" description="Registros de todos os profissionais, do mais recente ao mais antigo">
          {evolutions.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma evolução registrada. O profissional registra em <strong>Atendimento</strong> (ou pela Agenda).
            </p>
          ) : (
            <ul className="space-y-3">
              {evolutions.map((e) => (
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

        {legacyNotes.length > 0 && (
          <Card title="Anotações antigas" description="Registradas antes das evoluções; ficam aqui só para consulta">
            <ul className="space-y-3">
              {legacyNotes.map((n) => (
                <li key={n.id} className="rounded-lg border border-line p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <p className="mt-2 text-xs text-muted">
                    {formatDateTime(n.createdAt)}{n.author ? ` · ${n.author.name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Financeiro ─────────────────────────

async function FinancialTab({ patientId, canFinance }: { patientId: string; canFinance: boolean }) {
  const [patient, entries, engagements] = await Promise.all([
    db.patient.findUniqueOrThrow({ where: { id: patientId } }),
    canFinance
      ? db.financialEntry.findMany({
          where: { patientId, kind: "INCOME" },
          orderBy: { dueDate: "desc" },
          take: 100,
        })
      : [],
    canFinance
      ? db.engagement.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          include: {
            service: { select: { name: true } },
            professional: { select: { name: true } },
            entries: { select: { status: true, amountCents: true, paidAmountCents: true } },
          },
        })
      : [],
  ]);

  const live = entries.filter((e) => e.status !== "CANCELED");
  const overdue = live.filter((e) => entryDisplayStatus(e).key === "OVERDUE").reduce((s, e) => s + e.amountCents, 0);
  const open = live.filter((e) => entryDisplayStatus(e).key === "PENDING").reduce((s, e) => s + e.amountCents, 0);
  const paid = live.filter((e) => e.status === "PAID").reduce((s, e) => s + (e.paidAmountCents ?? e.amountCents), 0);

  return (
    <div className="space-y-6">
      {canFinance ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4"><p className="text-xs text-muted">Pago</p><p className="mt-1 text-2xl font-semibold tabular-nums text-brand-700">{formatMoney(paid)}</p></div>
            <div className="card p-4"><p className="text-xs text-muted">Em aberto</p><p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">{formatMoney(open)}</p></div>
            <div className="card p-4"><p className="text-xs text-muted">Vencido</p><p className="mt-1 text-2xl font-semibold tabular-nums text-red-600">{formatMoney(overdue)}</p></div>
          </div>

          <Card title="Pacotes e lançamentos" description="Cobrança por sessão, pacote único ou parcelado" padded={false}>
            {engagements.length === 0 ? (
              <div className="p-5"><EmptyState title="Nenhum lançamento para este paciente" /></div>
            ) : (
              <div className="table-wrap rounded-none border-0">
                <table className="table">
                  <thead>
                    <tr><th>Nº</th><th>Serviço</th><th>Cobrança</th><th>Sessões</th><th className="text-right">Total</th><th className="text-right">Pago</th><th className="text-right">Em aberto</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {engagements.map((e) => {
                      const ePaid = e.entries.filter((x) => x.status === "PAID").reduce((s, x) => s + (x.paidAmountCents ?? x.amountCents), 0);
                      const eOpen = e.entries.filter((x) => x.status === "PENDING").reduce((s, x) => s + x.amountCents, 0);
                      return (
                        <tr key={e.id}>
                          <td className="tabular-nums"><Link href={`/lancamentos/${e.id}`} className="text-brand-700 hover:underline">#{e.number}</Link></td>
                          <td>{e.service.name}<p className="text-xs text-muted">{e.professional.name}</p></td>
                          <td>{billingModeLabels[e.billingMode]}</td>
                          <td className="tabular-nums">{e.quantity}</td>
                          <td className="text-right tabular-nums">{formatMoney(e.totalCents)}</td>
                          <td className="text-right tabular-nums">{formatMoney(ePaid)}</td>
                          <td className="text-right tabular-nums">{formatMoney(eOpen)}</td>
                          <td><Badge tone={engagementTone(e.status)}>{engagementStatusLabels[e.status]}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Cobranças e pagamentos" padded={false}>
            {entries.length === 0 ? (
              <div className="p-5"><EmptyState title="Nenhuma cobrança" /></div>
            ) : (
              <div className="table-wrap rounded-none border-0">
                <table className="table">
                  <thead>
                    <tr><th>Descrição</th><th>Vencimento</th><th className="text-right">Valor</th><th>Pago em</th><th>Forma</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => {
                      const st = entryDisplayStatus(e);
                      return (
                        <tr key={e.id}>
                          <td><Link href={`/financeiro/receber/${e.id}`} className="font-medium text-brand-800 hover:underline">{e.description}</Link></td>
                          <td className="whitespace-nowrap">{formatDate(e.dueDate)}</td>
                          <td className="text-right tabular-nums">{formatMoney(e.amountCents)}</td>
                          <td className="whitespace-nowrap">{e.paidOn ? formatDate(e.paidOn) : "—"}</td>
                          <td>{e.paymentMethod ? paymentMethodLabels[e.paymentMethod] : "—"}</td>
                          <td><Badge tone={st.tone}>{st.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          Seu perfil não tem acesso ao módulo Financeiro: cobranças e pagamentos não são exibidos.
        </p>
      )}

      <Card title="Dados financeiros" description="Responsável pelo pagamento e preferências de cobrança">
        <ActionForm action={savePatientFinancial}>
          <input type="hidden" name="id" value={patient.id} />
          <FormGrid>
            <TextField name="billingName" label="Responsável financeiro" span={2} hint="Quando diferente do paciente" defaultValue={patient.billingName} />
            <MaskedField name="billingCpf" label="CPF do responsável financeiro" mask="cpf" defaultValue={patient.billingCpf} />
            <TextField name="billingEmail" label="E-mail para cobrança" type="email" defaultValue={patient.billingEmail} />
            <MaskedField name="billingPhone" label="Telefone para cobrança" mask="phone" defaultValue={patient.billingPhone} />
            <SelectField
              name="preferredPaymentMethod" label="Forma de pagamento preferida"
              options={optionsOf(paymentMethodLabels)} defaultValue={patient.preferredPaymentMethod}
            />
            <SelectField
              name="defaultDueDay" label="Dia de vencimento preferido" options={DUE_DAYS}
              defaultValue={patient.defaultDueDay ? String(patient.defaultDueDay) : ""}
            />
            <TextareaField name="financialNotes" label="Observações financeiras" span={4} defaultValue={patient.financialNotes} />
          </FormGrid>
          <FormActions>
            <SubmitButton>Salvar dados financeiros</SubmitButton>
          </FormActions>
        </ActionForm>
      </Card>
    </div>
  );
}

// ───────────────────────── Documentos ─────────────────────────

async function DocumentsTab({ patientId }: { patientId: string }) {
  const files = await db.patientFile.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  const canPreview = (mime: string) => mime === "application/pdf" || mime.startsWith("image/");

  return (
    <Card title="Documentos" description={`Laudos, exames, termos e outros arquivos. Até ${MAX_FILES_PER_UPLOAD} arquivos por envio, ${formatBytes(MAX_FILE_BYTES)} no total (PDF, imagens, Word, Excel…)`}>
      {files.length === 0 ? (
        <p className="mb-5 text-sm text-muted">Nenhum documento anexado.</p>
      ) : (
        <ul className="mb-5 divide-y divide-line rounded-lg border border-line">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{f.fileName}</span>
                  <span className="text-xs text-muted">{formatBytes(f.sizeBytes)} · {formatDateTime(f.createdAt)}</span>
                </span>
              </span>
              <span className="flex items-center gap-3">
                {canPreview(f.mimeType) && (
                  <a href={`/pacientes/arquivo/${f.id}?inline=1`} target="_blank" rel="noopener" className="text-brand-700 hover:underline">Abrir</a>
                )}
                <a href={`/pacientes/arquivo/${f.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                  <Download className="size-3.5" /> Baixar
                </a>
                <ActionForm action={deletePatientFile} hideMessages>
                  <input type="hidden" name="id" value={f.id} />
                  <ConfirmSubmit message={`Remover o documento “${f.fileName}”?`} variant="outline">Remover</ConfirmSubmit>
                </ActionForm>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={uploadPatientFiles} resetOnSuccess>
        <input type="hidden" name="patientId" value={patientId} />
        <FileField name="files" label="Anexar documentos" accept={FILE_ACCEPT} multiple />
        <FormActions>
          <SubmitButton variant="outline">Enviar documentos</SubmitButton>
        </FormActions>
      </ActionForm>
    </Card>
  );
}
