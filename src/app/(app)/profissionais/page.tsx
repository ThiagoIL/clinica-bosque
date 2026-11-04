import Link from "next/link";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/cpf";
import { dateOnlyToString } from "@/lib/dates";
import {
  ActionForm, CheckboxField, ComboField, DeleteButton, FormActions, FormGrid, MaskedField, SelectField, SubmitButton,
  TextField, TextareaField,
} from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, param } from "@/components/ui/primitives";
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
  const q = param(sp.q)?.trim() ?? "";
  const kind = param(sp.kind) ?? "";
  const status = param(sp.status) ?? "all";

  const [professionals, editing] = await Promise.all([
    db.professional.findMany({
      where: {
        ...(status === "active" ? { active: true } : status === "inactive" ? { active: false } : {}),
        ...(kind === "attends" ? { attends: true } : kind === "supplier" ? { attends: false } : {}),
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { role: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { specialty: { select: { name: true } }, contracts: { select: { status: true } } },
    }),
    editId && editId !== "new" ? db.professional.findUnique({ where: { id: editId } }) : null,
  ]);
  // só entram na lista as especialidades ativas (mais a atual do profissional, mesmo inativa)
  const specialties = showForm
    ? await db.specialty.findMany({
        where: { OR: [{ active: true }, ...(editing?.specialtyId ? [{ id: editing.specialtyId }] : [])] },
        orderBy: { name: "asc" },
      })
    : [];
  // sugestões do campo "Função / tipo de serviço": os serviços cadastrados
  const serviceNames = showForm
    ? await db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } })
    : [];

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Médicos, terapeutas e demais pessoas e empresas ligadas à clínica. Também são os favorecidos de contratos, contas a pagar e entradas de estoque."
        actions={!showForm && <LinkButton href="/profissionais?edit=new">Novo profissional</LinkButton>}
      />

      {showForm && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo profissional"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveProfessional}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField name="name" label="Nome / razão social" required span={2} defaultValue={editing?.name} />
              <ComboField
                name="role" label="Função / tipo de serviço" defaultValue={editing?.role}
                options={serviceNames.map((s) => s.name)}
                hint="Escolha um serviço cadastrado ou “Outro” para digitar (ex.: Limpeza, Fornecedor de materiais)"
              />
              <SelectField
                name="specialtyId" label="Especialidade" placeholder="Sem especialidade"
                options={specialties.map((s) => ({ value: s.id, label: s.active ? s.name : `${s.name} (inativa)` }))}
                defaultValue={editing?.specialtyId}
                hint={specialties.length === 0 ? "Cadastre em Cadastros › Especialidades" : undefined}
              />
              <TextField name="registryType" label="Conselho (CRM, CRP…)" defaultValue={editing?.registryType} />
              <TextField name="registryNumber" label="Nº do registro" defaultValue={editing?.registryNumber} />
              <TextField name="cpf" label="CPF / CNPJ" inputMode="numeric" defaultValue={editing?.cpf} />
              <TextField
                name="birthDate" label="Data de nascimento" type="date"
                defaultValue={editing?.birthDate ? dateOnlyToString(editing.birthDate) : ""}
              />
              <MaskedField name="phone" label="Telefone" mask="phone" defaultValue={editing?.phone} />
              <TextField name="email" label="E-mail" type="email" defaultValue={editing?.email} />
              <TextareaField name="notes" label="Observações" span={3} defaultValue={editing?.notes} />
              <CheckboxField
                name="attends" label="Atende pacientes"
                defaultChecked={editing?.attends ?? true}
                hint="Aparece na agenda e nos lançamentos. Desmarque para fornecedores e prestadores (limpeza, materiais…), que só entram em contratos e contas a pagar."
              />
              <CheckboxField name="active" label="Cadastro ativo" defaultChecked={editing?.active ?? true} />
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/profissionais" variant="outline">Cancelar</LinkButton>
              {editing && (
                <>
                  <LinkButton href={`/contratos?professional=${editing.id}&status=all`} variant="outline">Ver contratos</LinkButton>
                  <LinkButton href={`/contratos/novo?professional=${editing.id}`} variant="outline">Novo contrato</LinkButton>
                  <span className="ml-auto">
                    <DeleteButton
                      action={deleteProfessional} id={editing.id}
                      message={`Excluir “${editing.name}”? Quem já tem atendimentos, contratos ou contas a pagar não pode ser excluído; desative o cadastro nesse caso.`}
                    >
                      Excluir profissional
                    </DeleteButton>
                  </span>
                </>
              )}
            </FormActions>
          </ActionForm>
        </Card>
      )}

      <FilterBar action="/profissionais">
        <FilterField label="Buscar (nome ou função)" className="min-w-64 flex-1">
          <input name="q" defaultValue={q} className="input" placeholder="Digite para buscar…" />
        </FilterField>
        <FilterField label="Tipo">
          <select name="kind" defaultValue={kind} className="input">
            <option value="">Todos</option>
            <option value="attends">Atendem pacientes</option>
            <option value="supplier">Só favorecidos (fornecedores)</option>
          </select>
        </FilterField>
        <FilterField label="Situação">
          <select name="status" defaultValue={status} className="input">
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </FilterField>
      </FilterBar>

      {professionals.length === 0 ? (
        <EmptyState title="Nenhum profissional encontrado" description="Cadastre os profissionais para poder agendar atendimentos." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Função</th><th>Especialidade</th><th>Registro</th><th>Telefone</th><th>Contratos</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {professionals.map((p) => {
                const activeContracts = p.contracts.filter((c) => c.status === "ACTIVE").length;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/profissionais?edit=${p.id}`} className="font-medium text-brand-800 hover:underline">
                        {p.name}
                      </Link>
                      {!p.attends && <span className="ml-2 text-xs text-muted">não atende</span>}
                    </td>
                    <td>{p.role ?? "—"}</td>
                    <td>{p.specialty?.name ?? "—"}</td>
                    <td>{[p.registryType, p.registryNumber].filter(Boolean).join(" ") || "—"}</td>
                    <td>{formatPhone(p.phone) || "—"}</td>
                    <td>
                      {p.contracts.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <Link href={`/contratos?professional=${p.id}&status=all`} className="text-brand-700 hover:underline">
                          {activeContracts} ativo{activeContracts === 1 ? "" : "s"}
                        </Link>
                      )}
                    </td>
                    <td>{p.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                    <td className="whitespace-nowrap text-right">
                      <Link href={`/profissionais?edit=${p.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
