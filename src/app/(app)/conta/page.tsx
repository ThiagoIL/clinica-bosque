import { requireUser } from "@/lib/auth";
import { userRoleLabels } from "@/lib/labels";
import { ActionForm, FormActions, FormGrid, SubmitButton, TextField } from "@/components/ui/form-kit";
import { Card, PageHeader } from "@/components/ui/primitives";
import { updateAccount } from "./actions";

export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Minha conta" description={`${user.email} · ${userRoleLabels[user.role]}`} />
      <Card title="Dados e senha" className="max-w-2xl">
        <ActionForm action={updateAccount} resetOnSuccess>
          <FormGrid cols={2}>
            <TextField name="name" label="Nome" required span={2} defaultValue={user.name} />
            <TextField
              name="currentPassword" label="Senha atual" type="password" autoComplete="current-password" span={2}
              hint="Necessária apenas para trocar a senha"
            />
            <TextField name="newPassword" label="Nova senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres" />
            <TextField name="confirmPassword" label="Confirmar nova senha" type="password" autoComplete="new-password" />
          </FormGrid>
          <FormActions>
            <SubmitButton>Salvar</SubmitButton>
          </FormActions>
        </ActionForm>
      </Card>
    </>
  );
}
