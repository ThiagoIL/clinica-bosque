import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { optionsOf, userRoleLabels } from "@/lib/labels";
import { ActionForm, CheckboxField, DeleteButton, FormActions, FormGrid, SelectField, SubmitButton, TextField } from "@/components/ui/form-kit";
import { Badge, Card, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { deleteUser, saveUser } from "./actions";

export const metadata = { title: "Usuários" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const editId = param(sp.edit);

  const [users, profiles, editing] = await Promise.all([
    db.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { accessProfile: { select: { name: true } } },
    }),
    db.accessProfile.findMany({ orderBy: { name: "asc" } }),
    editId && editId !== "new" ? db.user.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem acessa o sistema. O administrador da empresa tem acesso total; os usuários seguem o perfil de acesso."
        actions={
          editId === undefined && (
            <>
              <LinkButton href="/perfis" variant="outline">Perfis de acesso</LinkButton>
              <LinkButton href="/usuarios?edit=new">Novo usuário</LinkButton>
            </>
          )
        }
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo usuário"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveUser}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField name="name" label="Nome" required defaultValue={editing?.name} />
              <TextField name="email" label="E-mail (login)" type="email" required autoComplete="off" defaultValue={editing?.email} />
              <SelectField
                name="role" label="Nível" required allowEmpty={false}
                options={optionsOf(userRoleLabels)} defaultValue={editing?.role ?? "STAFF"}
              />
              <SelectField
                name="accessProfileId" label="Perfil de acesso (para usuários)" placeholder="Sem perfil"
                options={profiles.map((p) => ({ value: p.id, label: p.name }))}
                defaultValue={editing?.accessProfileId}
                hint={
                  profiles.length === 0
                    ? "Crie um perfil em “Perfis de acesso”. Usuário sem perfil não acessa os módulos."
                    : "Vale só para o nível Usuário. Sem perfil, o usuário não acessa os módulos."
                }
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
              {editing && editing.id !== me.id && (
                <span className="ml-auto">
                  <DeleteButton
                    action={deleteUser} id={editing.id}
                    message={`Excluir o usuário “${editing.name}”? Ele perde o acesso ao sistema. Para manter o cadastro, desative-o em vez de excluir.`}
                  >
                    Excluir usuário
                  </DeleteButton>
                </span>
              )}
            </FormActions>
          </ActionForm>
        </Card>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Nível</th><th>Perfil de acesso</th><th>Situação</th><th>Último acesso</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">
                  <Link href={`/usuarios?edit=${u.id}`} className="text-brand-800 hover:underline">{u.name}</Link>{" "}
                  {u.id === me.id && <span className="text-xs text-muted">(você)</span>}
                </td>
                <td>{u.email}</td>
                <td>{userRoleLabels[u.role]}</td>
                <td>
                  {u.role === "ADMIN" ? (
                    <span className="text-muted">Acesso total</span>
                  ) : u.accessProfile ? (
                    u.accessProfile.name
                  ) : (
                    <span className="text-muted">Sem perfil</span>
                  )}
                </td>
                <td>{u.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                <td className="whitespace-nowrap text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                <td className="whitespace-nowrap text-right">
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
