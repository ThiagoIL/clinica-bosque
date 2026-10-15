import { PageHeader } from "@/components/ui/primitives";
import { PatientForm } from "../patient-form";

export const metadata = { title: "Novo paciente" };

export default function NewPatientPage() {
  return (
    <>
      <PageHeader title="Novo paciente" back={{ href: "/pacientes", label: "Pacientes" }} />
      <PatientForm />
    </>
  );
}
