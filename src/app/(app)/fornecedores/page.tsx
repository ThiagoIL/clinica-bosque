import Link from "next/link";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/cpf";
import { ActionForm, CheckboxField, FormActions, FormGrid, MaskedField, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { saveSupplier } from "./actions";

export const metadata = { title: "Fornecedores" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = param(sp.edit);
  const [suppliers, editing] = await Promise.all([
    db.supplier.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    editId && editId !== "new" ? db.supplier.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <>
      <PageHeader
        title="Fornecedores"
        description="Fornecedores usados em contas a pagar e entradas de estoque."
        actions={editId === undefined && <LinkButton href="/fornecedores?edit=new">Novo fornecedor</LinkButton>}
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo fornecedor"} className="mb-6">
          <ActionForm action={saveSupplier}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField name="name" label="Nome / razão social" required span={2} defaultValue={editing?.name} />
              <TextField name="document" label="CNPJ / CPF" inputMode="numeric" defaultValue={editing?.document} />
              <MaskedField name="phone" label="Telefone" mask="phone" defaultValue={editing?.phone} />
              <TextField name="email" label="E-mail" type="email" span={2} defaultValue={editing?.email} />
              <TextareaField name="notes" label="Observações" span={3} defaultValue={editing?.notes} />
              <CheckboxField name="active" label="Fornecedor ativo" defaultChecked={editing?.active ?? true} />
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/fornecedores" variant="outline">Cancelar</LinkButton>
            </FormActions>
          </ActionForm>
        </Card>
      )}

      {suppliers.length === 0 ? (
        <EmptyState title="Nenhum fornecedor cadastrado" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>E-mail</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.document ?? "—"}</td>
                  <td>{formatPhone(s.phone) || "—"}</td>
                  <td>{s.email ?? "—"}</td>
                  <td>{s.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  <td className="text-right">
                    <Link href={`/fornecedores?edit=${s.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
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
