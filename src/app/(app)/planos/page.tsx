import Link from "next/link";
import { db } from "@/lib/db";
import { ActionForm, CheckboxField, FormActions, FormGrid, SubmitButton, TextField, TextareaField } from "@/components/ui/form-kit";
import { Badge, Card, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { saveHealthPlan } from "./actions";

export const metadata = { title: "Planos de saúde" };

export default async function HealthPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = param(sp.edit);

  const [plans, editing] = await Promise.all([
    db.healthPlan.findMany({
      orderBy: [{ isDefault: "desc" }, { active: "desc" }, { name: "asc" }],
      include: { _count: { select: { patients: true, servicePrices: true } } },
    }),
    editId && editId !== "new" ? db.healthPlan.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <>
      <PageHeader
        title="Planos de saúde"
        description="Convênios atendidos pela clínica. Cada plano tem a sua própria tabela de preços; “Particular” é o plano padrão."
        actions={editId === undefined && <LinkButton href="/planos?edit=new">Novo plano</LinkButton>}
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo plano de saúde"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveHealthPlan}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid>
              <TextField
                name="name" label="Nome" required defaultValue={editing?.name} disabled={editing?.isDefault}
                hint={editing?.isDefault ? "O plano Particular não pode ser renomeado" : undefined}
              />
              <TextareaField name="notes" label="Observações" span={2} rows={2} defaultValue={editing?.notes} />
              {editing && !editing.isDefault && <CheckboxField name="active" label="Plano ativo" defaultChecked={editing.active} />}
            </FormGrid>
            {!editing && <p className="mt-3 text-xs text-muted">Depois de criar, você vai para a tabela de preços do novo plano.</p>}
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/planos" variant="outline">Cancelar</LinkButton>
            </FormActions>
          </ActionForm>
        </Card>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Plano</th><th>Pacientes</th><th>Serviços com preço</th><th>Situação</th><th /></tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">
                  {p.name} {p.isDefault && <Badge tone="violet">Padrão</Badge>}
                </td>
                <td className="tabular-nums">{p._count.patients}</td>
                <td className="tabular-nums">{p._count.servicePrices}</td>
                <td>{p.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                <td className="space-x-3 text-right text-sm">
                  <Link href={`/precos?plan=${p.id}`} className="text-brand-700 hover:underline">Tabela de preços</Link>
                  <Link href={`/planos?edit=${p.id}`} className="text-brand-700 hover:underline">Editar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
