import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { loadSnapshot } from "@/lib/access";
import { moduleLabel } from "@/lib/modules";
import { ActionForm, ConfirmSubmit, SubmitButton, TextareaField } from "@/components/ui/form-kit";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/primitives";
import { setSystemBlock } from "../actions";

export const metadata = { title: "Status do sistema" };
export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  BLOCK: "Bloqueio",
  UNBLOCK: "Liberação",
  BLOCK_MESSAGE: "Mensagem",
  MODULES: "Módulos",
  PASSWORD: "Senha",
  USER: "Usuário",
};

export default async function PlatformHomePage() {
  const settings = await db.systemSettings.findUnique({ where: { id: "singleton" } });
  const snapshot = await loadSnapshot(null);
  const [activeUsers, lastLogin, patients, events] = await Promise.all([
    db.user.count({ where: { active: true } }),
    db.user.aggregate({ _max: { lastLoginAt: true } }),
    db.patient.count({ where: { active: true } }),
    db.platformEvent.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const blocked = settings?.blocked ?? false;

  return (
    <>
      <PageHeader
        title="Status do sistema"
        description="Bloqueie o acesso da clínica em caso de falta de pagamento e libere novamente quando regularizar."
        actions={blocked ? <Badge tone="red">Bloqueado</Badge> : <Badge tone="green">Ativo</Badge>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Usuários ativos" value={activeUsers} />
        <Stat label="Pacientes ativos" value={patients} />
        <Stat
          label="Último acesso de um usuário"
          value={<span className="text-lg">{lastLogin._max.lastLoginAt ? formatDateTime(lastLogin._max.lastLoginAt) : "—"}</span>}
        />
      </div>

      <Card
        title={blocked ? "O sistema está bloqueado" : "Bloquear o sistema"}
        description={
          blocked
            ? `Bloqueado desde ${settings?.blockedAt ? formatDateTime(settings.blockedAt) : "—"}. Todos os usuários veem a tela de acesso suspenso.`
            : "Os usuários logados perdem o acesso em poucos segundos e veem a mensagem abaixo."
        }
      >
        <ActionForm action={setSystemBlock}>
          <TextareaField
            name="message"
            label="Mensagem exibida para a clínica"
            rows={3}
            defaultValue={settings?.blockMessage}
            hint="Opcional. Ex.: “Identificamos uma pendência no pagamento. Entre em contato: (11) 99999-9999.”"
          />
          <div className="mt-5 flex flex-wrap gap-3">
            {blocked ? (
              <>
                <SubmitButton name="blocked" value="0">Liberar o sistema</SubmitButton>
                <SubmitButton name="blocked" value="1" variant="outline">Atualizar mensagem</SubmitButton>
              </>
            ) : (
              <ConfirmSubmit
                name="blocked"
                value="1"
                size={undefined}
                message="Bloquear o sistema? Ninguém da clínica conseguirá acessar até você liberar."
              >
                Bloquear o sistema
              </ConfirmSubmit>
            )}
          </div>
        </ActionForm>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Módulos liberados">
          <div className="flex flex-wrap gap-2">
            {snapshot.enabled.length === 0 && <span className="text-sm text-muted">Nenhum módulo liberado.</span>}
            {snapshot.enabled.map((k) => (
              <Badge key={k} tone="green">{moduleLabel(k)}</Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Altere em “Módulos”.</p>
        </Card>

        <Card title="Histórico" padded={false}>
          {events.length === 0 ? (
            <p className="p-5 text-sm text-muted">Nenhum evento registrado.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p>
                      <Badge tone={e.type === "BLOCK" ? "red" : e.type === "UNBLOCK" ? "green" : "gray"}>
                        {EVENT_LABELS[e.type] ?? e.type}
                      </Badge>{" "}
                      {e.message}
                    </p>
                    {e.adminEmail && <p className="text-xs text-muted">{e.adminEmail}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted">{formatDateTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
