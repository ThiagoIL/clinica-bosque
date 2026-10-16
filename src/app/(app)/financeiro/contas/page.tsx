import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney, centsToInput } from "@/lib/money";
import { accountTypeLabels, entryKindLabels, optionsOf } from "@/lib/labels";
import { ActionForm, CheckboxField, FormActions, FormGrid, SelectField, SubmitButton, TextField } from "@/components/ui/form-kit";
import { Badge, Card, LinkButton, PageHeader, param } from "@/components/ui/primitives";
import { saveAccount, saveCategory } from "./actions";

export const metadata = { title: "Contas e categorias" };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const accountEdit = param(sp.account);
  const categoryEdit = param(sp.category);

  const [accounts, categories, editingAccount, editingCategory] = await Promise.all([
    db.financialAccount.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.financialCategory.findMany({ orderBy: [{ kind: "asc" }, { active: "desc" }, { name: "asc" }] }),
    accountEdit && accountEdit !== "new" ? db.financialAccount.findUnique({ where: { id: accountEdit } }) : null,
    categoryEdit && categoryEdit !== "new" ? db.financialCategory.findUnique({ where: { id: categoryEdit } }) : null,
  ]);

  return (
    <>
      <PageHeader
        title="Contas e categorias"
        description="Contas (caixa e bancos) usadas na baixa de pagamentos e categorias para classificar receitas e despesas."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base">Contas financeiras</h2>
            {accountEdit === undefined && <LinkButton href="/financeiro/contas?account=new" size="sm">Nova conta</LinkButton>}
          </div>
          {accountEdit !== undefined && (
            <Card title={editingAccount ? "Editar conta" : "Nova conta"} className="mb-4">
              <ActionForm key={editingAccount?.id ?? "new"} action={saveAccount}>
                {editingAccount && <input type="hidden" name="id" value={editingAccount.id} />}
                <FormGrid cols={2}>
                  <TextField name="name" label="Nome" required defaultValue={editingAccount?.name} />
                  <SelectField
                    name="type" label="Tipo" required allowEmpty={false}
                    options={optionsOf(accountTypeLabels)} defaultValue={editingAccount?.type ?? "BANK"}
                  />
                  <TextField
                    name="initialBalance" label="Saldo inicial (R$)" inputMode="decimal"
                    defaultValue={centsToInput(editingAccount?.initialBalanceCents ?? 0)}
                  />
                  <CheckboxField name="active" label="Conta ativa" defaultChecked={editingAccount?.active ?? true} />
                </FormGrid>
                <FormActions>
                  <SubmitButton>Salvar</SubmitButton>
                  <LinkButton href="/financeiro/contas" variant="outline">Cancelar</LinkButton>
                </FormActions>
              </ActionForm>
            </Card>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nome</th><th>Tipo</th><th className="text-right">Saldo inicial</th><th /></tr></thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">
                      {a.name} {!a.active && <Badge>Inativa</Badge>}
                    </td>
                    <td>{accountTypeLabels[a.type]}</td>
                    <td className="text-right tabular-nums">{formatMoney(a.initialBalanceCents)}</td>
                    <td className="text-right">
                      <Link href={`/financeiro/contas?account=${a.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base">Categorias</h2>
            {categoryEdit === undefined && <LinkButton href="/financeiro/contas?category=new" size="sm">Nova categoria</LinkButton>}
          </div>
          {categoryEdit !== undefined && (
            <Card title={editingCategory ? "Editar categoria" : "Nova categoria"} className="mb-4">
              <ActionForm key={editingCategory?.id ?? "new"} action={saveCategory}>
                {editingCategory && <input type="hidden" name="id" value={editingCategory.id} />}
                <FormGrid cols={2}>
                  <TextField name="name" label="Nome" required defaultValue={editingCategory?.name} />
                  <SelectField
                    name="kind" label="Tipo" required allowEmpty={false}
                    options={optionsOf(entryKindLabels)} defaultValue={editingCategory?.kind ?? "EXPENSE"}
                  />
                  <CheckboxField name="active" label="Categoria ativa" defaultChecked={editingCategory?.active ?? true} />
                </FormGrid>
                <FormActions>
                  <SubmitButton>Salvar</SubmitButton>
                  <LinkButton href="/financeiro/contas" variant="outline">Cancelar</LinkButton>
                </FormActions>
              </ActionForm>
            </Card>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nome</th><th>Tipo</th><th /></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">
                      {c.name} {!c.active && <Badge>Inativa</Badge>}
                    </td>
                    <td>
                      <Badge tone={c.kind === "INCOME" ? "green" : "amber"}>{entryKindLabels[c.kind]}</Badge>
                    </td>
                    <td className="text-right">
                      <Link href={`/financeiro/contas?category=${c.id}`} className="text-sm text-brand-700 hover:underline">Editar</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
