import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { MODULES, LEVEL_LABELS, parseEnabledModules, parsePermissions } from "@/lib/modules";
import {
  ActionForm, ConfirmSubmit, FormActions, FormGrid, SelectField, SubmitButton, TextField,
} from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { deleteAccessProfile, saveAccessProfile } from "./actions";

export const metadata = { title: "Perfis de acesso" };

export default async function AccessProfilesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const editId = param(sp.edit);

  const [settings, profiles, editing] = await Promise.all([
    db.systemSettings.findUnique({ where: { id: "singleton" } }),
    db.accessProfile.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } }),
    editId && editId !== "new" ? db.accessProfile.findUnique({ where: { id: editId } }) : null,
  ]);
  const enabled = settings ? parseEnabledModules(settings.enabledModules) : [];
  const modules = MODULES.filter((m) => enabled.includes(m.key));
  const editingPerms = parsePermissions(editing?.permissions);

  return (
    <>
      <PageHeader
        title="Perfis de acesso"
        description="O que cada perfil pode ver e alterar em cada módulo. Ligue o perfil ao usuário na tela de usuários. Administradores da empresa têm acesso total."
        back={{ href: "/usuarios", label: "Usuários" }}
        actions={editId === undefined && <LinkButton href="/perfis?edit=new">Novo perfil</LinkButton>}
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo perfil"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveAccessProfile}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid cols={4}>
              <TextField name="name" label="Nome do perfil" required span={4} defaultValue={editing?.name} />
              {modules.map((m) => (
                <SelectField
                  key={m.key}
                  name={`perm_${m.key}`}
                  label={m.label}
                  allowEmpty={false}
                  defaultValue={editingPerms[m.key] ?? "NONE"}
                  options={(["NONE", "VIEW", "EDIT"] as const).map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
                />
              ))}
            </FormGrid>
            <p className="mt-3 text-xs text-muted">
              <strong>Consulta</strong> vê as telas e os dados; <strong>Edita</strong> também cadastra, altera e cancela.
              Só aparecem os módulos liberados pelo fornecedor do sistema.
            </p>
            <FormActions>
              <SubmitButton>Salvar perfil</SubmitButton>
              <LinkButton href="/perfis" variant="outline">Cancelar</LinkButton>
            </FormActions>
          </ActionForm>
          {editing && (
            <ActionForm action={deleteAccessProfile} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="id" value={editing.id} />
              <ConfirmSubmit message="Excluir este perfil de acesso?">Excluir perfil</ConfirmSubmit>
            </ActionForm>
          )}
        </Card>
      )}

      {profiles.length === 0 ? (
        <EmptyState
          title="Nenhum perfil cadastrado"
          description="Crie perfis (ex.: Recepção, Financeiro) para liberar apenas os módulos de cada função."
          action={<LinkButton href="/perfis?edit=new">Novo perfil</LinkButton>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Perfil</th>
                {modules.map((m) => (
                  <th key={m.key}>{m.label}</th>
                ))}
                <th className="text-right">Usuários</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const perms = parsePermissions(p.permissions);
                return (
                  <tr key={p.id}>
                    <td className="font-medium">
                      <Link href={`/perfis?edit=${p.id}`} className="text-brand-800 hover:underline">{p.name}</Link>
                    </td>
                    {modules.map((m) => {
                      const level = perms[m.key] ?? "NONE";
                      return (
                        <td key={m.key}>
                          {level === "NONE" ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <Badge tone={level === "EDIT" ? "green" : "gray"}>{LEVEL_LABELS[level]}</Badge>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right tabular-nums">{p._count.users}</td>
                    <td className="text-right">
                      <Link href={`/perfis?edit=${p.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
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
