import type { Contract } from "@/generated/prisma/client";
import { ActionForm, FileField, FormActions, FormGrid, SelectField, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import { FILE_ACCEPT, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, formatBytes } from "@/lib/contracts";
import { dateOnlyToString } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import { saveContract } from "./actions";

export function ContractForm({
  contract,
  collaborators,
  defaultCollaboratorId,
}: {
  contract?: Contract;
  collaborators: { id: string; name: string }[];
  defaultCollaboratorId?: string;
}) {
  return (
    <ActionForm action={saveContract}>
      {contract && <input type="hidden" name="id" value={contract.id} />}
      <FormGrid>
        <SelectField
          name="collaboratorId" label="Colaborador" required span={2}
          options={collaborators.map((c) => ({ value: c.id, label: c.name }))}
          defaultValue={contract?.collaboratorId ?? defaultCollaboratorId}
        />
        <TextField name="code" label="Nº / código do contrato" defaultValue={contract?.code} />
        <TextField name="title" label="Título / objeto" required span={3} defaultValue={contract?.title} />
        <TextField name="startDate" label="Início da vigência" type="date" required defaultValue={contract ? dateOnlyToString(contract.startDate) : ""} />
        <TextField
          name="endDate" label="Fim da vigência" type="date"
          hint="Em branco = prazo indeterminado"
          defaultValue={contract?.endDate ? dateOnlyToString(contract.endDate) : ""}
        />
        <TextField
          name="value" label="Valor (R$)" inputMode="decimal"
          defaultValue={contract?.valueCents != null ? centsToInput(contract.valueCents) : ""}
        />
        <TextField name="valueNote" label="Referente a" hint="Ex.: mensal, por sessão, total" defaultValue={contract?.valueNote} />
        <TextareaField name="description" label="Descrição / observações" span={4} rows={3} defaultValue={contract?.description} />
        {!contract && (
          <FileField
            name="files" label="Anexos (opcional)" accept={FILE_ACCEPT} multiple span={4}
            hint={`Contrato assinado e outros documentos: até ${MAX_FILES_PER_UPLOAD} arquivos, ${formatBytes(MAX_FILE_BYTES)} no total. Também dá para anexar depois.`}
          />
        )}
      </FormGrid>
      <FormActions>
        <SubmitButton>{contract ? "Salvar contrato" : "Cadastrar contrato"}</SubmitButton>
        <LinkButton href="/contratos" variant="outline">Voltar</LinkButton>
      </FormActions>
    </ActionForm>
  );
}
