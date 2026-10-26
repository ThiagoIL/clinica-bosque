-- Especialidades (cadastro), data de nascimento do profissional e tipo do atendimento no lancamento.

-- 1) Tipo do atendimento passa a ser do lancamento (Consulta / Retorno / Sessao)
CREATE TYPE "AttendanceKind" AS ENUM ('CONSULTATION', 'RETURN', 'SESSION');

ALTER TABLE "Engagement" ADD COLUMN "kind" "AttendanceKind" NOT NULL DEFAULT 'SESSION';

-- preserva o que ja existia: o tipo do servico vira o tipo do lancamento
UPDATE "Engagement" e
SET "kind" = CASE s."kind"::text
  WHEN 'CONSULTATION' THEN 'CONSULTATION'::"AttendanceKind"
  WHEN 'RETURN' THEN 'RETURN'::"AttendanceKind"
  ELSE 'SESSION'::"AttendanceKind"
END
FROM "Service" s
WHERE s."id" = e."serviceId";

ALTER TABLE "Service" DROP COLUMN "kind";
DROP TYPE "ServiceKind";

-- 2) Especialidades
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Specialty_name_key" ON "Specialty"("name");

-- 3) Profissional: especialidade vinculada ao cadastro + data de nascimento
ALTER TABLE "Professional" ADD COLUMN "specialtyId" TEXT;
ALTER TABLE "Professional" ADD COLUMN "birthDate" DATE;

-- as especialidades digitadas antes viram registros do cadastro (sem duplicar por maiuscula/minuscula)
INSERT INTO "Specialty" ("id", "name")
SELECT 'spc_' || md5(lower(btrim("specialty"))), min(btrim("specialty"))
FROM "Professional"
WHERE "specialty" IS NOT NULL AND btrim("specialty") <> ''
GROUP BY lower(btrim("specialty"));

UPDATE "Professional" p
SET "specialtyId" = s."id"
FROM "Specialty" s
WHERE p."specialty" IS NOT NULL AND lower(btrim(p."specialty")) = lower(s."name");

ALTER TABLE "Professional" DROP COLUMN "specialty";

CREATE INDEX "Professional_specialtyId_idx" ON "Professional"("specialtyId");

ALTER TABLE "Professional"
  ADD CONSTRAINT "Professional_specialtyId_fkey"
  FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
