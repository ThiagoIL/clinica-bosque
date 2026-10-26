import type { Patient } from "@/generated/prisma/client";
import {
  ActionForm, CheckboxField, FormActions, FormGrid, MaskedField, SelectField, SubmitButton,
  TextField, TextareaField,
} from "@/components/ui/form-kit";
import { Tabs } from "@/components/ui/tabs";
import { LinkButton } from "@/components/ui/primitives";
import { dateOnlyToString } from "@/lib/dates";
import { optionsOf, paymentMethodLabels, sexLabels, UF } from "@/lib/labels";
import { savePatient } from "./actions";

const MARITAL = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"].map((v) => ({ value: v, label: v }));
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({ value: v, label: v }));
const DUE_DAYS = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }));

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
    <ActionForm action={savePatient} className="card p-5">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Tabs
        tabs={[
          {
            id: "paciente",
            label: "Dados do paciente",
            content: (
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
                <SelectField
                  name="state" label="UF" defaultValue={p?.state}
                  options={UF.map((u) => ({ value: u, label: u }))}
                />
                {p && <CheckboxField name="active" label="Cadastro ativo" defaultChecked={p.active} />}
              </FormGrid>
            ),
          },
          {
            id: "familiar",
            label: "Familiar / responsável",
            content: (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm">Responsável</h3>
                  <FormGrid>
                    <TextField name="guardianName" label="Nome" span={2} defaultValue={p?.guardianName} />
                    <TextField name="guardianRelationship" label="Parentesco" defaultValue={p?.guardianRelationship} />
                    <MaskedField name="guardianCpf" label="CPF" mask="cpf" defaultValue={p?.guardianCpf} />
                    <MaskedField name="guardianPhone" label="Telefone" mask="phone" defaultValue={p?.guardianPhone} />
                    <TextField name="guardianEmail" label="E-mail" type="email" defaultValue={p?.guardianEmail} />
                  </FormGrid>
                </div>
                <div>
                  <h3 className="mb-3 text-sm">Contato de emergência</h3>
                  <FormGrid>
                    <TextField name="emergencyContactName" label="Nome" span={2} defaultValue={p?.emergencyContactName} />
                    <TextField name="emergencyContactRelationship" label="Parentesco" defaultValue={p?.emergencyContactRelationship} />
                    <MaskedField name="emergencyContactPhone" label="Telefone" mask="phone" defaultValue={p?.emergencyContactPhone} />
                  </FormGrid>
                </div>
              </div>
            ),
          },
          {
            id: "saude",
            label: "Dados de saúde",
            content: (
              <FormGrid>
                <SelectField name="bloodType" label="Tipo sanguíneo" options={BLOOD} defaultValue={p?.bloodType} />
                <TextareaField name="diagnosis" label="Diagnóstico / queixa principal" span={2} defaultValue={p?.diagnosis} />
                <TextareaField name="allergies" label="Alergias" span={2} defaultValue={p?.allergies} />
                <TextareaField name="medications" label="Medicamentos em uso" span={2} defaultValue={p?.medications} />
                <TextareaField name="chronicConditions" label="Condições crônicas" span={2} defaultValue={p?.chronicConditions} />
                <TextareaField name="surgeries" label="Cirurgias anteriores" span={2} defaultValue={p?.surgeries} />
                <TextareaField name="healthNotes" label="Outras informações de saúde" span={4} defaultValue={p?.healthNotes} />
              </FormGrid>
            ),
          },
          {
            id: "financeiro",
            label: "Dados financeiros",
            content: (
              <FormGrid>
                <TextField
                  name="billingName" label="Responsável financeiro" span={2}
                  hint="Quando diferente do paciente"
                  defaultValue={p?.billingName}
                />
                <MaskedField name="billingCpf" label="CPF do responsável financeiro" mask="cpf" defaultValue={p?.billingCpf} />
                <TextField name="billingEmail" label="E-mail para cobrança" type="email" defaultValue={p?.billingEmail} />
                <MaskedField name="billingPhone" label="Telefone para cobrança" mask="phone" defaultValue={p?.billingPhone} />
                <SelectField
                  name="preferredPaymentMethod" label="Forma de pagamento preferida"
                  options={optionsOf(paymentMethodLabels)} defaultValue={p?.preferredPaymentMethod}
                />
                <SelectField
                  name="defaultDueDay" label="Dia de vencimento preferido" options={DUE_DAYS}
                  defaultValue={p?.defaultDueDay ? String(p.defaultDueDay) : ""}
                />
                <TextareaField name="financialNotes" label="Observações financeiras" span={4} defaultValue={p?.financialNotes} />
              </FormGrid>
            ),
          },
          {
            id: "observacoes",
            label: "Observações",
            content: (
              <FormGrid cols={2}>
                <TextareaField name="observations" label="Observações gerais" span={2} rows={8} defaultValue={p?.observations} />
              </FormGrid>
            ),
          },
        ]}
      />
      <FormActions>
        <SubmitButton>{p ? "Salvar alterações" : "Cadastrar paciente"}</SubmitButton>
        <LinkButton href="/pacientes" variant="outline">Voltar</LinkButton>
      </FormActions>
    </ActionForm>
  );
}
