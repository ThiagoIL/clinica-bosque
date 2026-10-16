import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { optionsOf, userRoleLabels } from "@/lib/labels";
import { ActionForm, CheckboxField, FormActions, FormGrid, SelectField, SubmitButton, TextField } from "@/components/ui/form-kit";
import { Badge, Card, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { saveUser } from "./actions";

export const metadata = { title: "Usuários" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const editId = param(sp.edit);

  const [users, editing] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    editId && editId !== "new" ? db.user.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem pode acessar o sistema. Administradores gerenciam usuários; o perfil Atendimento usa o dia a dia da clínica."
        actions={editId === undefined && <LinkButton href="/usuarios?edit=new">Novo usuário</LinkButton>}
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo usuário"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveUser}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField name="name" label="Nome" required defaultValue={editing?.name} />
              <TextField name="email" label="E-mail (login)" type="email" required autoComplete="off" defaultValue={editing?.email} />
              <SelectField
                name="role" label="Perfil" required allowEmpty={false}
                options={optionsOf(userRoleLabels)} defaultValue={editing?.role ?? "STAFF"}
              />
              <TextField
                name="password" label={editing ? "Nova senha" : "Senha"} type="password" autoComplete="new-password"
                required={!editing}
                hint={editing ? "Deixe em branco para manter a senha atual (mín. 8 caracteres)" : "Mínimo de 8 caracteres"}
              />
              <CheckboxField name="active" label="Usuário ativo" defaultChecked={editing?.active ?? true} />
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/usuarios" variant="outline">Cancelar</LinkButton>
            </FormActions>
          </ActionForm>
        </Card>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Criado em</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">
                  {u.name} {u.id === me.id && <span className="text-xs text-muted">(você)</span>}
                </td>
                <td>{u.email}</td>
                <td><Badge tone={u.role === "ADMIN" ? "violet" : "blue"}>{userRoleLabels[u.role]}</Badge></td>
                <td>{u.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(u.createdAt)}</td>
                <td className="text-right">
                  <Link href={`/usuarios?edit=${u.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
