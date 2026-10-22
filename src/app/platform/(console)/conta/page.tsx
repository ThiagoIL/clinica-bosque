import { requirePlatformAdmin } from "@/lib/platform-auth";
import { ActionForm, FormActions, FormGrid, SubmitButton, TextField } from "@/components/ui/form-kit";
import { Card, PageHeader } from "@/components/ui/primitives";
import { updatePlatformAccount } from "../../actions";

export const metadata = { title: "Minha conta" };

export default async function PlatformAccountPage() {
  const admin = await requirePlatformAdmin();
  return (
    <>
      <PageHeader title="Minha conta" description={admin.email} />
      <Card title="Dados e senha" className="max-w-2xl">
        <ActionForm action={updatePlatformAccount} resetOnSuccess>
          <FormGrid cols={2}>
            <TextField name="name" label="Nome" required span={2} defaultValue={admin.name} />
            <TextField
              name="currentPassword" label="Senha atual" type="password" autoComplete="current-password" span={2}
              hint="Necessária apenas para trocar a senha"
            />
            <TextField name="newPassword" label="Nova senha" type="password" autoComplete="new-password" hint="Mínimo de 10 caracteres" />
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
