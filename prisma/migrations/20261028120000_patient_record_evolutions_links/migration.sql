-- Prontuário do paciente (anamnese, evoluções, foto, documentos), vínculos usuário/profissional/colaborador
-- e informação de quem cancelou o atendimento. Só adiciona: nenhum dado existente é alterado ou removido.

CREATE TYPE "CancelParty" AS ENUM ('PATIENT', 'PROFESSIONAL');

-- Vínculos
ALTER TABLE "User" ADD COLUMN "professionalId" TEXT;
ALTER TABLE "Professional" ADD COLUMN "collaboratorId" TEXT;

-- Paciente
ALTER TABLE "Patient" ADD COLUMN "naturalness" TEXT;
ALTER TABLE "Patient" ADD COLUMN "education" TEXT;
ALTER TABLE "Patient" ADD COLUMN "anamnesis" JSONB;

-- Atendimento
ALTER TABLE "Appointment" ADD COLUMN "canceledBy" "CancelParty";

-- Foto, documentos e evoluções
CREATE TABLE "PatientPhoto" (
    "patientId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPhoto_pkey" PRIMARY KEY ("patientId")
);

CREATE TABLE "PatientFile" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evolution" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_professionalId_key" ON "User"("professionalId");
CREATE UNIQUE INDEX "Professional_collaboratorId_key" ON "Professional"("collaboratorId");
CREATE INDEX "PatientFile_patientId_idx" ON "PatientFile"("patientId");
CREATE UNIQUE INDEX "Evolution_appointmentId_key" ON "Evolution"("appointmentId");
CREATE INDEX "Evolution_patientId_createdAt_idx" ON "Evolution"("patientId", "createdAt");
CREATE INDEX "Evolution_professionalId_idx" ON "Evolution"("professionalId");

ALTER TABLE "User" ADD CONSTRAINT "User_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientPhoto" ADD CONSTRAINT "PatientPhoto_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientFile" ADD CONSTRAINT "PatientFile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evolution" ADD CONSTRAINT "Evolution_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evolution" ADD CONSTRAINT "Evolution_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evolution" ADD CONSTRAINT "Evolution_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Evolution" ADD CONSTRAINT "Evolution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
