import { db } from "@/lib/db";
import { isDateString, isTimeString, todayString } from "@/lib/dates";
import { PageHeader, EmptyState, LinkButton, param } from "@/components/ui/primitives";
import { EngagementForm } from "./engagement-form";

export const metadata = { title: "Novo lançamento" };

export default async function NewEngagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const [patients, professionals, services] = await Promise.all([
    db.patient.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.professional.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const missing = [
    patients.length === 0 && { label: "Cadastrar um paciente", href: "/pacientes/novo" },
    professionals.length === 0 && { label: "Cadastrar um profissional", href: "/profissionais?edit=new" },
    services.length === 0 && { label: "Cadastrar um serviço", href: "/servicos?edit=new" },
  ].filter(Boolean) as { label: string; href: string }[];

  const date = param(sp.date);
  const time = param(sp.time);

  return (
    <>
      <PageHeader
        title="Novo lançamento"
        description="Lance a consulta, sessão ou terapia: o sistema agenda os horários e gera o financeiro."
        back={{ href: "/lancamentos", label: "Lançamentos" }}
      />
      {missing.length > 0 ? (
        <EmptyState
          title="Faltam cadastros para lançar um atendimento"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {missing.map((m) => (
                <LinkButton key={m.href} href={m.href} variant="outline">{m.label}</LinkButton>
              ))}
            </div>
          }
        />
      ) : (
        <EngagementForm
          patients={patients}
          professionals={professionals}
          services={services.map((s) => ({ id: s.id, name: s.name, priceCents: s.defaultPriceCents, duration: s.durationMinutes }))}
          defaults={{
            patientId: param(sp.patientId),
            professionalId: param(sp.professionalId),
            date: isDateString(date) ? date : todayString(),
            time: isTimeString(time) ? time : "08:00",
          }}
        />
      )}
    </>
  );
}
