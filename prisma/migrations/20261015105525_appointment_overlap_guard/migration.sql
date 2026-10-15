-- Barra, no próprio banco, agendamentos que se sobrepõem no tempo.
-- Um profissional não pode ter dois atendimentos ao mesmo tempo, e o mesmo
-- vale para o paciente. Agendamentos cancelados não ocupam horário.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_professional_overlap"
  EXCLUDE USING gist (
    "professionalId" WITH =,
    tsrange("startsAt", "endsAt") WITH &&
  ) WHERE ("status" <> 'CANCELED');

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_patient_overlap"
  EXCLUDE USING gist (
    "patientId" WITH =,
    tsrange("startsAt", "endsAt") WITH &&
  ) WHERE ("status" <> 'CANCELED');

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_valid_range" CHECK ("endsAt" > "startsAt");
