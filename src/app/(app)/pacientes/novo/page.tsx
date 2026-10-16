import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/primitives";
import { PatientForm } from "../patient-form";

export const metadata = { title: "Novo paciente" };

export default async function NewPatientPage() {
  const plans = await db.healthPlan.findMany({ where: { active: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Novo paciente" back={{ href: "/pacientes", label: "Pacientes" }} />
      <PatientForm plans={plans} defaultPlanId={plans.find((p) => p.isDefault)?.id} />
    </>
  );
}
