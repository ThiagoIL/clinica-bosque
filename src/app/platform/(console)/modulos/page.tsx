import { db } from "@/lib/db";
import { MODULES, DEFAULT_ENABLED_MODULES, parseEnabledModules } from "@/lib/modules";
import { ActionForm, CheckboxField, FormActions, SubmitButton } from "@/components/ui/form-kit";
import { Card, PageHeader } from "@/components/ui/primitives";
import { saveEnabledModules } from "../../actions";

export const metadata = { title: "Módulos" };
export const dynamic = "force-dynamic";

export default async function PlatformModulesPage() {
  const settings = await db.systemSettings.findUnique({ where: { id: "singleton" } });
  const enabled = settings ? parseEnabledModules(settings.enabledModules) : DEFAULT_ENABLED_MODULES;

  return (
    <>
      <PageHeader
        title="Módulos"
        description="Escolha quais módulos aparecem no sistema da clínica. O administrador da clínica define, dentro do que você liberar, o que cada perfil de usuário acessa."
      />
      <Card>
        <ActionForm action={saveEnabledModules}>
          <ul className="divide-y divide-line">
            {MODULES.map((m) => (
              <li key={m.key} className="py-3 first:pt-0 last:pb-0">
                <CheckboxField
                  name={`module_${m.key}`}
                  label={m.label}
                  hint={m.description}
                  defaultChecked={enabled.includes(m.key)}
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
            Atenção: <strong>Lançamentos</strong> dependem de Pacientes, Profissionais e Cadastros (serviços). Desligar um
            módulo o esconde para todos, inclusive para o administrador da clínica; os dados são mantidos.
          </p>
          <FormActions>
            <SubmitButton>Salvar módulos</SubmitButton>
          </FormActions>
        </ActionForm>
      </Card>
    </>
  );
}
