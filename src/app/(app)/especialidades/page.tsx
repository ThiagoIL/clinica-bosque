import Link from "next/link";
import { db } from "@/lib/db";
import {
  ActionForm, CheckboxField, DeleteButton, FormActions, FormGrid, SubmitButton, TextField,
} from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { deleteSpecialty, saveSpecialty } from "./actions";

export const metadata = { title: "Especialidades" };

export default async function SpecialtiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = param(sp.edit);

  const [specialties, editing] = await Promise.all([
    db.specialty.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { professionals: true } } },
    }),
    editId && editId !== "new" ? db.specialty.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <>
      <PageHeader
        title="Especialidades"
        description="Lista usada no cadastro dos profissionais e nos filtros da agenda e dos lançamentos."
        actions={editId === undefined && <LinkButton href="/especialidades?edit=new">Nova especialidade</LinkButton>}
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Nova especialidade"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveSpecialty}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField name="name" label="Nome" required defaultValue={editing?.name} />
              {editing && <CheckboxField name="active" label="Especialidade ativa" defaultChecked={editing.active} />}
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/especialidades" variant="outline">Cancelar</LinkButton>
              {editing && (
                <span className="ml-auto">
                  <DeleteButton
                    action={deleteSpecialty} id={editing.id}
                    message={`Excluir a especialidade “${editing.name}”?`}
                  >
                    Excluir especialidade
                  </DeleteButton>
                </span>
              )}
            </FormActions>
          </ActionForm>
        </Card>
      )}

      {specialties.length === 0 ? (
        <EmptyState
          title="Nenhuma especialidade cadastrada"
          description="Cadastre as especialidades para vinculá-las aos profissionais."
          action={<LinkButton href="/especialidades?edit=new">Nova especialidade</LinkButton>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Especialidade</th><th>Profissionais</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {specialties.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">
                    <Link href={`/especialidades?edit=${s.id}`} className="text-brand-800 hover:underline">{s.name}</Link>
                  </td>
                  <td className="tabular-nums">{s._count.professionals}</td>
                  <td>{s.active ? <Badge tone="green">Ativa</Badge> : <Badge>Inativa</Badge>}</td>
                  <td className="text-right">
                    <Link href={`/especialidades?edit=${s.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
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
