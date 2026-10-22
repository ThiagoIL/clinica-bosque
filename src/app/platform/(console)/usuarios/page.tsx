import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { getPlatformBase, requirePlatformAdmin } from "@/lib/platform-auth";
import { ActionForm, CheckboxField, FormActions, FormGrid, SubmitButton, TextField } from "@/components/ui/form-kit";
import { Badge, Card, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { savePlatformAdmin } from "../../actions";

export const metadata = { title: "Usuários da administração" };
export const dynamic = "force-dynamic";

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePlatformAdmin();
  const base = await getPlatformBase();
  const editId = param((await searchParams).edit);

  const [admins, editing] = await Promise.all([
    db.platformAdmin.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    editId && editId !== "new" ? db.platformAdmin.findUnique({ where: { id: editId } }) : null,
  ]);
  const href = (q?: string) => `${base}/usuarios${q ? `?${q}` : ""}`;

  return (
    <>
      <PageHeader
        title="Usuários da administração"
        description="Pessoas com acesso a este console (bloqueio do sistema e módulos). Não têm acesso ao sistema da clínica."
        actions={editId === undefined && <LinkButton href={href("edit=new")}>Novo usuário</LinkButton>}
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo usuário"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={savePlatformAdmin}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField name="name" label="Nome" required defaultValue={editing?.name} />
              <TextField name="email" label="E-mail (login)" type="email" required autoComplete="off" defaultValue={editing?.email} />
              <TextField
                name="password" label={editing ? "Nova senha" : "Senha"} type="password" autoComplete="new-password"
                required={!editing}
                hint={editing ? "Deixe em branco para manter a senha atual (mín. 10 caracteres)" : "Mínimo de 10 caracteres"}
              />
              <CheckboxField name="active" label="Usuário ativo" defaultChecked={editing?.active ?? true} />
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href={href()} variant="outline">Cancelar</LinkButton>
            </FormActions>
          </ActionForm>
        </Card>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Situação</th><th>Criado em</th><th /></tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">
                  {a.name} {a.id === me.id && <span className="text-xs text-muted">(você)</span>}
                </td>
                <td>{a.email}</td>
                <td>{a.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(a.createdAt)}</td>
                <td className="text-right">
                  <Link href={href(`edit=${a.id}`)} className="text-sm text-brand-700 hover:underline">Editar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
