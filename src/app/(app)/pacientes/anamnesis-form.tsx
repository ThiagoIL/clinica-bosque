import type { Patient } from "@/generated/prisma/client";
import {
  ActionForm, CheckGroupField, FormActions, SelectField, SubmitButton, TextField, TextareaField,
} from "@/components/ui/form-kit";
import { ANAMNESIS_PREFIX, ANAMNESIS_SECTIONS, parseAnamnesis, type AnField } from "@/lib/anamnesis";
import { ageFromBirth, dateOnlyToString } from "@/lib/dates";
import { formatPhone } from "@/lib/cpf";
import { sexLabels } from "@/lib/labels";
import { savePatientAnamnesis } from "./actions";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">
        {title}
        <span className="text-muted transition-transform group-open:rotate-180">▲</span>
      </summary>
      <div className="mx-auto max-w-2xl space-y-4 border-t border-line px-4 py-5">{children}</div>
    </details>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <input disabled value={value} readOnly placeholder="—" className="input" />
    </div>
  );
}

/** Aba "Anamnese": ficha de avaliação inicial, no formato usado pelos profissionais da clínica. */
export function AnamnesisForm({ patient }: { patient: Patient }) {
  const data = parseAnamnesis(patient.anamnesis);
  const columns = patient as unknown as Record<string, unknown>;

  const text = (f: { key: string; column?: boolean }) => {
    const v = f.column ? columns[f.key] : data[f.key];
    return typeof v === "string" ? v : "";
  };
  const list = (key: string) => {
    const v = data[key];
    return Array.isArray(v) ? v : [];
  };

  function renderField(f: AnField) {
    const name = ANAMNESIS_PREFIX + f.key;
    switch (f.type) {
      case "text":
        return <TextField key={f.key} name={name} label={f.label} defaultValue={text(f)} />;
      case "textarea":
        return <TextareaField key={f.key} name={name} label={f.label} rows={3} defaultValue={text(f)} />;
      case "select":
        return (
          <SelectField
            key={f.key} name={name} label={f.label} placeholder="-- Selecione --"
            options={f.options.map((o) => ({ value: o, label: o }))} defaultValue={text(f)}
          />
        );
      case "checks":
        return <CheckGroupField key={f.key} name={name} label={f.label} options={f.options} defaultValues={list(f.key)} />;
      case "awareness":
        return (
          <div key={f.key}>
            <span className="label">{f.label}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                name={name} label="Nível" placeholder="-- Selecione --"
                options={f.options.map((o) => ({ value: o, label: o }))}
                defaultValue={typeof data[f.key] === "string" ? (data[f.key] as string) : ""}
              />
              <TextField
                name={`${name}Text`} label="Observação"
                defaultValue={typeof data[`${f.key}Text`] === "string" ? (data[`${f.key}Text`] as string) : ""}
              />
            </div>
          </div>
        );
    }
  }

  return (
    <ActionForm action={savePatientAnamnesis} className="space-y-4">
      <input type="hidden" name="id" value={patient.id} />

      <Block title="Identificação — adulto">
        <ReadOnlyField label="Nome do cliente" value={patient.name} />
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadOnlyField label="Telefone" value={formatPhone(patient.phone) || ""} />
          <ReadOnlyField label="Data de nascimento" value={patient.birthDate ? dateOnlyToString(patient.birthDate).split("-").reverse().join("/") : ""} />
          <ReadOnlyField label="Idade" value={ageFromBirth(patient.birthDate)?.toString() ?? ""} />
          <ReadOnlyField label="Gênero" value={patient.sex ? sexLabels[patient.sex] : ""} />
          <ReadOnlyField label="Naturalidade" value={patient.naturalness ?? ""} />
          <ReadOnlyField label="Escolaridade" value={patient.education ?? ""} />
        </div>
        <p className="text-xs text-muted">Estes dados vêm da aba Cadastro.</p>
        <TextareaField
          name={`${ANAMNESIS_PREFIX}observations`} label="Observações" rows={3}
          defaultValue={typeof data.observations === "string" ? data.observations : ""}
        />
      </Block>

      {ANAMNESIS_SECTIONS.map((section) => (
        <Block key={section.id} title={section.title}>
          {section.fields.map(renderField)}
        </Block>
      ))}

      <FormActions>
        <SubmitButton>Salvar anamnese</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
