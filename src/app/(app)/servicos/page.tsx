import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney, centsToInput } from "@/lib/money";
import { ActionForm, CheckboxField, DeleteButton, FormActions, FormGrid, SubmitButton, TextField } from "@/components/ui/form-kit";
import { Badge, Card, EmptyState, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { deleteService, saveService } from "./actions";

export const metadata = { title: "Serviços" };

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const editId = param(sp.edit);
  const particular = await db.healthPlan.findFirst({ where: { isDefault: true } });
  const [services, editing] = await Promise.all([
    db.service.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { prices: { where: { healthPlanId: particular?.id ?? "" } }, _count: { select: { prices: true } } },
    }),
    editId && editId !== "new"
      ? db.service.findUnique({ where: { id: editId }, include: { prices: { where: { healthPlanId: particular?.id ?? "" } } } })
      : null,
  ]);

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Catálogo dos serviços prestados pela clínica. Os valores por plano de saúde ficam na tabela de preços."
        actions={
          editId === undefined && (
            <>
              <LinkButton href="/precos" variant="outline">Tabela de preços</LinkButton>
              <LinkButton href="/servicos?edit=new">Novo serviço</LinkButton>
            </>
          )
        }
      />

      {editId !== undefined && (
        <Card title={editing ? `Editar ${editing.name}` : "Novo serviço"} className="mb-6">
          <ActionForm key={editing?.id ?? "new"} action={saveService}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <FormGrid cols={4}>
              <TextField name="name" label="Nome" required span={2} defaultValue={editing?.name} />
              <TextField
                name="particularPrice" label="Valor Particular (R$)" inputMode="decimal"
                hint="Os demais planos são definidos na tabela de preços"
                defaultValue={editing?.prices[0] ? centsToInput(editing.prices[0].priceCents) : ""}
              />
              <TextField
                name="durationMinutes" label="Duração (min)" required type="number" min={5} max={600}
                defaultValue={editing?.durationMinutes ?? 50}
              />
              <CheckboxField name="active" label="Serviço ativo" defaultChecked={editing?.active ?? true} />
            </FormGrid>
            <FormActions>
              <SubmitButton>Salvar</SubmitButton>
              <LinkButton href="/servicos" variant="outline">Cancelar</LinkButton>
              {editing && (
                <span className="ml-auto">
                  <DeleteButton
                    action={deleteService} id={editing.id}
                    message={`Excluir o serviço “${editing.name}” e os preços dele na tabela? Serviços já usados em lançamentos não podem ser excluídos.`}
                  >
                    Excluir serviço
                  </DeleteButton>
                </span>
              )}
            </FormActions>
          </ActionForm>
        </Card>
      )}

      {services.length === 0 ? (
        <EmptyState title="Nenhum serviço cadastrado" description="Cadastre ao menos um serviço para lançar atendimentos." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Particular</th><th>Planos com preço</th><th>Duração</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">
                    <Link href={`/servicos?edit=${s.id}`} className="text-brand-800 hover:underline">{s.name}</Link>
                  </td>
                  <td className="tabular-nums">{s.prices[0] ? formatMoney(s.prices[0].priceCents) : <span className="text-muted">sem preço</span>}</td>
                  <td className="tabular-nums">{s._count.prices}</td>
                  <td>{s.durationMinutes} min</td>
                  <td>{s.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/servicos?edit=${s.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
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
