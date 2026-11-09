import { Download } from "lucide-react";
import { ActionForm, FileField, FormActions, SubmitButton } from "@/components/ui/form-kit";
import { Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "@/lib/patient-import";
import { importPatients } from "./actions";

export const metadata = { title: "Importar pacientes" };

export default function ImportPatientsPage() {
  return (
    <>
      <PageHeader
        title="Importar pacientes por planilha"
        description="Cadastre vários pacientes de uma vez a partir de uma planilha do Excel."
        back={{ href: "/pacientes", label: "Pacientes" }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title="Enviar a planilha">
          <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>Baixe o modelo e preencha a aba <strong className="text-ink">Pacientes</strong> (só o <strong className="text-ink">Nome</strong> é obrigatório).</li>
            <li>Envie o arquivo (.xlsx) e clique em <strong className="text-ink">Conferir</strong>: nada é gravado, você só vê o resultado.</li>
            <li>Estando certo, clique em <strong className="text-ink">Importar</strong>.</li>
          </ol>
          <p className="mb-5 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
            Os nomes são padronizados: tudo em minúsculas e a primeira letra de cada nome em maiúscula (“MARIA DA SILVA” vira “Maria da Silva”).
            Pacientes com CPF já cadastrado, ou com o mesmo nome e data de nascimento, são ignorados. Máximo de {MAX_IMPORT_ROWS} pacientes por arquivo.
          </p>

          <ActionForm action={importPatients}>
            <FileField name="file" label="Planilha do Excel" accept=".xlsx" required />
            <FormActions>
              <SubmitButton name="mode" value="check" variant="outline">Conferir</SubmitButton>
              <SubmitButton name="mode" value="import">Importar</SubmitButton>
              <LinkButton href="/pacientes" variant="ghost">Voltar</LinkButton>
            </FormActions>
          </ActionForm>
        </Card>

        <Card title="Modelo e colunas">
          <a href="/pacientes/importar/modelo" download className="btn btn-outline mb-4 w-full justify-center">
            <Download className="size-4" /> Baixar planilha modelo
          </a>
          <ul className="space-y-1 text-xs text-muted">
            {IMPORT_COLUMNS.map((c) => (
              <li key={c.key}>
                <strong className="text-ink">{c.title}</strong>
                {c.key === "name" && <span className="text-red-600"> *</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">A aba “Instruções” do modelo explica como preencher cada coluna.</p>
        </Card>
      </div>
    </>
  );
}
