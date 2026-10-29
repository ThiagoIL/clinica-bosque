import Link from "next/link";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/cpf";
import { ActionForm, CheckboxField, ComboField, DeleteButton, FormActions, FormGrid, MaskedField, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, FilterBar, FilterField, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { deleteCollaborator, saveCollaborator } from "./actions";

export const metadata = { title: "Colaboradores" };

export default async function CollaboratorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = param(sp.edit);
  const q = param(sp.q)?.trim() ?? "";
  const status = param(sp.status) ?? "active";

  const [collaborators, editing, serviceNames] = await Promise.all([
    db.collaborator.findMany({
      where: {
        ...(status === "active" ? { active: true } : status === "inactive" ? { active: false } : {}),
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { role: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { contracts: { select: { status: true } } },
    }),
    editId && editId !== "new"
      ? db.collaborator.findUnique({ where: { id: editId }, include: { professional: { select: { id: true, name: true } } } })
      : null,
    // sugestões do campo "Função / tipo de serviço": os serviços cadastrados
    editId !== undefined
      ? db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } })
      : [],
  ]);

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Pessoas e empresas que prestam serviço ou fornecem à clínica. São também os favorecidos das contas a pagar."
        actions={
          editId === undefined && (
            <>
              <LinkButton href="/contratos" variant="outline">Contratos</LinkButton>
              <LinkButton href="/colaboradores?edit=new">Novo colaborador</LinkButton>
            </>
          )
        }
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo colaborador"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveCollaborator}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField name="name" label="Nome / razão social" required span={2} defaultValue={editing?.name} />
              <ComboField
                name="role" label="Função / tipo de serviço" defaultValue={editing?.role}
                options={serviceNames.map((s) => s.name)}
                hint="Escolha um serviço cadastrado ou “Outro” para digitar (ex.: Limpeza, Fornecedor de materiais)"
              />
              <TextField name="document" label="CPF / CNPJ" inputMode="numeric" defaultValue={editing?.document} />
              <MaskedField name="phone" label="Telefone" mask="phone" defaultValue={editing?.phone} />
              <TextField name="email" label="E-mail" type="email" defaultValue={editing?.email} />
              <TextareaField name="notes" label="Observações" span={3} defaultValue={editing?.notes} />
              <CheckboxField name="active" label="Colaborador ativo" defaultChecked={editing?.active ?? true} />
            </FormGrid>
            {editing?.professional && (
              <p className="mt-3 text-xs text-muted">
                Também cadastrado como profissional:{" "}
                <Link href={`/profissionais?edit=${editing.professional.id}`} className="text-brand-700 hover:underline">
                  {editing.professional.name}
                </Link>
              </p>
            )}
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/colaboradores" variant="outline">Cancelar</LinkButton>
              {editing && (
                <>
                  <LinkButton href={`/contratos?collaborator=${editing.id}&status=all`} variant="outline">Ver contratos</LinkButton>
                  <LinkButton href={`/contratos/novo?collaborator=${editing.id}`} variant="outline">Novo contrato</LinkButton>
                  <span className="ml-auto">
                    <DeleteButton
                      action={deleteCollaborator} id={editing.id}
                      message={`Excluir o colaborador “${editing.name}”? Quem tem contratos ou contas a pagar não pode ser excluído; desative o cadastro nesse caso.`}
                    >
                      Excluir colaborador
                    </DeleteButton>
                  </span>
                </>
              )}
            </FormActions>
          </ActionForm>
        </Card>
      )}

      <FilterBar action="/colaboradores">
        <FilterField label="Buscar (nome ou função)" className="min-w-64 flex-1">
          <input name="q" defaultValue={q} className="input" placeholder="Digite para buscar…" />
        </FilterField>
        <FilterField label="Situação">
          <select name="status" defaultValue={status} className="input">
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="all">Todos</option>
          </select>
        </FilterField>
      </FilterBar>

      {collaborators.length === 0 ? (
        <EmptyState title="Nenhum colaborador encontrado" action={<LinkButton href="/colaboradores?edit=new">Novo colaborador</LinkButton>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Função</th><th>Documento</th><th>Telefone</th><th>Contratos</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {collaborators.map((c) => {
                const active = c.contracts.filter((x) => x.status === "ACTIVE").length;
                const ended = c.contracts.length - active;
                return (
                  <tr key={c.id}>
                    <td className="font-medium">
                      <Link href={`/colaboradores?edit=${c.id}`} className="text-brand-800 hover:underline">{c.name}</Link>
                    </td>
                    <td>{c.role ?? "—"}</td>
                    <td>{c.document ?? "—"}</td>
                    <td>{formatPhone(c.phone) || "—"}</td>
                    <td>
                      <Link href={`/contratos?collaborator=${c.id}&status=all`} className="text-brand-700 hover:underline">
                        {active} ativo{active === 1 ? "" : "s"}
                        {ended > 0 && <span className="text-muted"> · {ended} encerrado{ended === 1 ? "" : "s"}</span>}
                      </Link>
                    </td>
                    <td>{c.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                    <td className="text-right text-sm">
                      <Link href={`/colaboradores?edit=${c.id}`} className="text-brand-700 hover:underline">Editar</Link>
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
