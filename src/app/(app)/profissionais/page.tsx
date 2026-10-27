import Link from "next/link";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/cpf";
import { dateOnlyToString } from "@/lib/dates";
import {
  ActionForm, CheckboxField, ColorField, DeleteButton, FormActions, FormGrid, MaskedField, SelectField, SubmitButton,
  TextField, TextareaField,
} from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { deleteProfessional, saveProfessional } from "./actions";

export const metadata = { title: "Profissionais" };

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = param(sp.edit);
  const showForm = editId !== undefined;

  const [professionals, editing] = await Promise.all([
    db.professional.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { specialty: { select: { name: true } } } }),
    editId && editId !== "new" ? db.professional.findUnique({ where: { id: editId } }) : null,
  ]);
  // só entram na lista as especialidades ativas (mais a atual do profissional, mesmo inativa)
  const specialties = showForm
    ? await db.specialty.findMany({
        where: { OR: [{ active: true }, ...(editing?.specialtyId ? [{ id: editing.specialtyId }] : [])] },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Médicos, terapeutas e demais profissionais que atendem na clínica."
        actions={!showForm && <LinkButton href="/profissionais?edit=new">Novo profissional</LinkButton>}
      />

      {showForm && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo profissional"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveProfessional}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField name="name" label="Nome" required span={2} defaultValue={editing?.name} />
              <SelectField
                name="specialtyId" label="Especialidade" placeholder="Sem especialidade"
                options={specialties.map((s) => ({ value: s.id, label: s.active ? s.name : `${s.name} (inativa)` }))}
                defaultValue={editing?.specialtyId}
                hint={specialties.length === 0 ? "Cadastre em Cadastros › Especialidades" : undefined}
              />
              <TextField name="registryType" label="Conselho (CRM, CRP…)" defaultValue={editing?.registryType} />
              <TextField name="registryNumber" label="Nº do registro" defaultValue={editing?.registryNumber} />
              <MaskedField name="cpf" label="CPF" mask="cpf" defaultValue={editing?.cpf} />
              <TextField
                name="birthDate" label="Data de nascimento" type="date"
                defaultValue={editing?.birthDate ? dateOnlyToString(editing.birthDate) : ""}
              />
              <MaskedField name="phone" label="Telefone" mask="phone" defaultValue={editing?.phone} />
              <TextField name="email" label="E-mail" type="email" defaultValue={editing?.email} />
              <ColorField name="color" label="Cor na agenda" span={2} defaultValue={editing?.color ?? "#2f8f68"} />
              <TextareaField name="notes" label="Observações" span={3} defaultValue={editing?.notes} />
              <CheckboxField name="active" label="Profissional ativo" defaultChecked={editing?.active ?? true} />
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/profissionais" variant="outline">Cancelar</LinkButton>
              {editing && (
                <span className="ml-auto">
                  <DeleteButton
                    action={deleteProfessional} id={editing.id}
                    message={`Excluir o profissional “${editing.name}”? Quem já tem atendimentos não pode ser excluído; desative o cadastro nesse caso.`}
                  >
                    Excluir profissional
                  </DeleteButton>
                </span>
              )}
            </FormActions>
          </ActionForm>
        </Card>
      )}

      {professionals.length === 0 ? (
        <EmptyState title="Nenhum profissional cadastrado" description="Cadastre os profissionais para poder agendar atendimentos." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Especialidade</th><th>Registro</th><th>Telefone</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {professionals.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/profissionais?edit=${p.id}`} className="inline-flex items-center gap-2 font-medium text-brand-800 hover:underline">
                      <span className="size-3 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.specialty?.name ?? "—"}</td>
                  <td>{[p.registryType, p.registryNumber].filter(Boolean).join(" ") || "—"}</td>
                  <td>{formatPhone(p.phone) || "—"}</td>
                  <td>{p.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/profissionais?edit=${p.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
