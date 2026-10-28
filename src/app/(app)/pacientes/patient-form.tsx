import type { Patient } from "@/generated/prisma/client";
import {
  ActionForm, CheckboxField, FormActions, FormGrid, MaskedField, SelectField, SubmitButton, TextField, TextareaField,
} from "@/components/ui/form-kit";
import { LinkButton } from "@/components/ui/primitives";
import { dateOnlyToString } from "@/lib/dates";
import { optionsOf, sexLabels, UF } from "@/lib/labels";
import { savePatient } from "./actions";

const MARITAL = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"].map((v) => ({ value: v, label: v }));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-line pb-1.5 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Aba "Cadastro": dados pessoais, plano de saúde e familiar / responsável juntos. */
export function PatientForm({
  patient,
  plans,
  defaultPlanId,
}: {
  patient?: Patient;
  plans: { id: string; name: string }[];
  defaultPlanId?: string;
}) {
  const p = patient;
  return (
    <ActionForm action={savePatient} className="card space-y-8 p-5">
      {p && <input type="hidden" name="id" value={p.id} />}

      <Section title="Dados do paciente">
        <FormGrid>
          <TextField name="name" label="Nome completo" required span={2} defaultValue={p?.name} />
          <TextField name="socialName" label="Nome social" defaultValue={p?.socialName} />
          <SelectField
            name="healthPlanId" label="Plano de saúde" allowEmpty={false}
            options={plans.map((x) => ({ value: x.id, label: x.name }))}
            defaultValue={p?.healthPlanId ?? defaultPlanId}
            hint="Define a tabela de preços usada nos lançamentos"
          />
          <TextField name="healthInsuranceNumber" label="Nº da carteirinha" defaultValue={p?.healthInsuranceNumber} />
          <MaskedField name="cpf" label="CPF" mask="cpf" defaultValue={p?.cpf} />
          <TextField name="rg" label="RG" defaultValue={p?.rg} />
          <TextField
            name="birthDate" label="Data de nascimento" type="date"
            defaultValue={p?.birthDate ? dateOnlyToString(p.birthDate) : ""}
          />
          <SelectField name="sex" label="Sexo" options={optionsOf(sexLabels)} defaultValue={p?.sex} />
          <SelectField name="maritalStatus" label="Estado civil" options={MARITAL} defaultValue={p?.maritalStatus} />
          <TextField name="naturalness" label="Naturalidade" defaultValue={p?.naturalness} />
          <TextField name="education" label="Escolaridade" defaultValue={p?.education} />
          <TextField name="occupation" label="Profissão" defaultValue={p?.occupation} />
          <MaskedField name="phone" label="Telefone / WhatsApp" mask="phone" defaultValue={p?.phone} />
          <MaskedField name="phone2" label="Telefone alternativo" mask="phone" defaultValue={p?.phone2} />
          <TextField name="email" label="E-mail" type="email" defaultValue={p?.email} />
          <MaskedField name="zipCode" label="CEP" mask="cep" defaultValue={p?.zipCode} />
          <TextField name="street" label="Logradouro" span={2} defaultValue={p?.street} />
          <TextField name="number" label="Número" defaultValue={p?.number} />
          <TextField name="complement" label="Complemento" defaultValue={p?.complement} />
          <TextField name="neighborhood" label="Bairro" defaultValue={p?.neighborhood} />
          <TextField name="city" label="Cidade" defaultValue={p?.city} />
          <SelectField name="state" label="UF" defaultValue={p?.state} options={UF.map((u) => ({ value: u, label: u }))} />
          {p && <CheckboxField name="active" label="Cadastro ativo" defaultChecked={p.active} />}
        </FormGrid>
      </Section>

      <Section title="Familiar / responsável">
        <FormGrid>
          <TextField name="guardianName" label="Responsável — nome" span={2} defaultValue={p?.guardianName} />
          <TextField name="guardianRelationship" label="Parentesco" defaultValue={p?.guardianRelationship} />
          <MaskedField name="guardianCpf" label="CPF do responsável" mask="cpf" defaultValue={p?.guardianCpf} />
          <MaskedField name="guardianPhone" label="Telefone do responsável" mask="phone" defaultValue={p?.guardianPhone} />
          <TextField name="guardianEmail" label="E-mail do responsável" type="email" defaultValue={p?.guardianEmail} />
          <TextField name="emergencyContactName" label="Contato de emergência — nome" span={2} defaultValue={p?.emergencyContactName} />
          <TextField name="emergencyContactRelationship" label="Parentesco" defaultValue={p?.emergencyContactRelationship} />
          <MaskedField name="emergencyContactPhone" label="Telefone de emergência" mask="phone" defaultValue={p?.emergencyContactPhone} />
        </FormGrid>
      </Section>

      <Section title="Observações">
        <FormGrid cols={2}>
          <TextareaField name="observations" label="Observações gerais" span={2} rows={5} defaultValue={p?.observations} />
        </FormGrid>
      </Section>

      <FormActions>
        <SubmitButton>{p ? "Salvar cadastro" : "Cadastrar paciente"}</SubmitButton>
        <LinkButton href="/pacientes" variant="outline">Voltar</LinkButton>
      </FormActions>
    </ActionForm>
  );
}
