import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, todayString } from "@/lib/dates";
import { FILE_ACCEPT, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, contractDisplay, formatBytes } from "@/lib/contracts";
import {
  ActionForm, ConfirmSubmit, FileField, FormActions, FormGrid, SubmitButton, TextField,
} from "@/components/ui/form-kit";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { ContractForm } from "../contract-form";
import { deleteContractFile, endContract, reopenContract, uploadContractFiles } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.contract.findUnique({ where: { id }, select: { title: true } });
  return { title: c?.title ?? "Contrato" };
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await db.contract.findUnique({
    where: { id },
    include: {
      collaborator: { select: { id: true, name: true } },
      files: {
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
    },
  });
  if (!contract) notFound();

  const collaborators = await db.collaborator.findMany({
    where: { OR: [{ active: true }, { id: contract.collaboratorId }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const st = contractDisplay(contract);
  const canPreview = (mime: string) => mime === "application/pdf" || mime.startsWith("image/");

  return (
    <>
      <PageHeader
        title={contract.title}
        description={contract.collaborator.name}
        back={{ href: "/contratos", label: "Contratos" }}
        actions={<Badge tone={st.tone}>{st.label}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Dados do contrato">
            <ContractForm contract={contract} collaborators={collaborators} />
          </Card>

          <Card title="Anexos" description={`Até ${MAX_FILES_PER_UPLOAD} arquivos por envio, ${formatBytes(MAX_FILE_BYTES)} no total (PDF, imagens, Word, Excel…)`}>
            {contract.files.length === 0 ? (
              <p className="mb-5 text-sm text-muted">Nenhum arquivo anexado.</p>
            ) : (
              <ul className="mb-5 divide-y divide-line rounded-lg border border-line">
                {contract.files.map((f) => (
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
                        <a href={`/contratos/arquivo/${f.id}?inline=1`} target="_blank" rel="noopener" className="text-brand-700 hover:underline">Abrir</a>
                      )}
                      <a href={`/contratos/arquivo/${f.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <Download className="size-3.5" /> Baixar
                      </a>
                      <ActionForm action={deleteContractFile} hideMessages>
                        <input type="hidden" name="id" value={f.id} />
                        <ConfirmSubmit message={`Remover o anexo “${f.fileName}”?`} variant="outline">Remover</ConfirmSubmit>
                      </ActionForm>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <ActionForm action={uploadContractFiles} resetOnSuccess>
              <input type="hidden" name="contractId" value={contract.id} />
              <FileField name="files" label="Anexar arquivos" accept={FILE_ACCEPT} multiple />
              <FormActions>
                <SubmitButton variant="outline">Enviar anexos</SubmitButton>
              </FormActions>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Vigência">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted">Início</dt><dd>{formatDate(contract.startDate)}</dd></div>
              <div><dt className="text-xs text-muted">Fim</dt><dd>{contract.endDate ? formatDate(contract.endDate) : "Prazo indeterminado"}</dd></div>
              {contract.status === "ENDED" && (
                <>
                  <div><dt className="text-xs text-muted">Encerrado em</dt><dd>{formatDate(contract.endedOn)}</dd></div>
                  {contract.endReason && <div><dt className="text-xs text-muted">Motivo</dt><dd>{contract.endReason}</dd></div>}
                </>
              )}
              <div>
                <dt className="text-xs text-muted">Colaborador</dt>
                <dd>
                  <Link href={`/contratos?collaborator=${contract.collaborator.id}&status=all`} className="text-brand-700 hover:underline">
                    {contract.collaborator.name}
                  </Link>
                </dd>
              </div>
            </dl>
          </Card>

          {contract.status === "ACTIVE" ? (
            <Card title="Encerrar contrato" description="O contrato passa para a lista de encerrados. Os anexos são mantidos.">
              <ActionForm action={endContract}>
                <input type="hidden" name="id" value={contract.id} />
                <FormGrid cols={2}>
                  <TextField name="endedOn" label="Data de encerramento" type="date" required span={2} defaultValue={todayString()} />
                  <TextField name="reason" label="Motivo" span={2} hint="Opcional. Ex.: fim do prazo, rescisão" />
                </FormGrid>
                <FormActions>
                  <ConfirmSubmit message="Encerrar este contrato?">Encerrar contrato</ConfirmSubmit>
                </FormActions>
              </ActionForm>
            </Card>
          ) : (
            <Card title="Contrato encerrado">
              <p className="mb-3 text-sm text-muted">
                Para renovar ou corrigir, reative o contrato e ajuste a vigência no formulário.
              </p>
              <ActionForm action={reopenContract}>
                <input type="hidden" name="id" value={contract.id} />
                <ConfirmSubmit message="Reativar este contrato?" variant="outline">Reativar contrato</ConfirmSubmit>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
