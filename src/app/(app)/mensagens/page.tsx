import Link from "next/link";
import { db } from "@/lib/db";
import {
  ActionForm, CheckboxField, DeleteButton, FormActions, FormGrid, SubmitButton, TextField,
} from "@/components/ui/form-kit";
import { MessageEditor } from "@/components/message-editor";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SearchBar, param } from "@/components/ui/primitives";
import { DEFAULT_TEMPLATE_BODY } from "@/lib/whatsapp";
import { deleteMessageTemplate, saveMessageTemplate } from "./actions";

export const metadata = { title: "Mensagens do WhatsApp" };

export default async function MessageTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = param(sp.edit);
  const q = param(sp.q)?.trim() ?? "";

  const [templates, editing] = await Promise.all([
    db.messageTemplate.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : undefined,
      orderBy: [{ isDefault: "desc" }, { active: "desc" }, { name: "asc" }] }),
    editId && editId !== "new" ? db.messageTemplate.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <>
      <PageHeader
        title="Mensagens do WhatsApp"
        description="Modelos de texto usados no botão do WhatsApp da agenda. Padronize os avisos aos pacientes: lembrete, reagendamento, cancelamento…"
        actions={editId === undefined && <LinkButton href="/mensagens?edit=new">Novo modelo</LinkButton>}
      />

      <SearchBar action="/mensagens" q={q} placeholder="Buscar modelo de mensagem…" hidden={editId !== undefined} />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo modelo"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveMessageTemplate}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid cols={2}>
              <TextField name="name" label="Nome do modelo" required defaultValue={editing?.name} maxLength={80} hint="Aparece na lista de escolha da agenda." />
              <div className="flex flex-col justify-end gap-2 pb-1">
                <CheckboxField name="isDefault" label="Modelo padrão (sugerido na agenda)" defaultChecked={editing?.isDefault ?? templates.length === 0} />
                {editing && <CheckboxField name="active" label="Modelo ativo" defaultChecked={editing.active} />}
              </div>
            </FormGrid>
            <div className="mt-4">
              <MessageEditor name="body" defaultValue={editing?.body ?? DEFAULT_TEMPLATE_BODY} />
            </div>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/mensagens" variant="outline">Cancelar</LinkButton>
              {editing && (
                <span className="ml-auto">
                  <DeleteButton
                    action={deleteMessageTemplate} id={editing.id}
                    message={`Excluir o modelo “${editing.name}”?`}
                  >
                    Excluir modelo
                  </DeleteButton>
                </span>
              )}
            </FormActions>
          </ActionForm>
        </Card>
      )}

      {templates.length === 0 ? (
        <EmptyState
          title="Nenhum modelo cadastrado"
          description="Sem modelos, a agenda envia a mensagem padrão de lembrete de consulta. Cadastre os seus para personalizar o texto."
          action={<LinkButton href="/mensagens?edit=new">Novo modelo</LinkButton>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Modelo</th><th>Início da mensagem</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">
                    <Link href={`/mensagens?edit=${t.id}`} className="text-brand-800 hover:underline">{t.name}</Link>
                    {t.isDefault && <span className="ml-2"><Badge tone="blue">Padrão</Badge></span>}
                  </td>
                  <td className="max-w-md truncate text-muted">{t.body.replace(/\s+/g, " ")}</td>
                  <td>{t.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  <td className="text-right">
                    <Link href={`/mensagens?edit=${t.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
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
