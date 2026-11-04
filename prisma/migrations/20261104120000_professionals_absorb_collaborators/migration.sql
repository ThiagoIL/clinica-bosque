-- Colaboradores passam a fazer parte de Profissionais.
-- Os colaboradores existentes viram profissionais (mesmo id, sem agenda), e contratos, contas a pagar e
-- movimentações de estoque passam a apontar para Profissionais. Nenhum registro é perdido.

-- Quem fez cada ação nos atendimentos
ALTER TABLE "Evolution" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "statusChangedById" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "statusChangedAt" TIMESTAMP(3);

-- O financeiro passa a depender só do perfil de acesso
ALTER TABLE "User" DROP COLUMN "canSeeFinance";

-- Função e "atende pacientes" no profissional
ALTER TABLE "Professional" ADD COLUMN "role" TEXT;
ALTER TABLE "Professional" ADD COLUMN "attends" BOOLEAN NOT NULL DEFAULT true;

-- Profissionais que já eram ligados a um colaborador herdam os dados que faltam
UPDATE "Professional" p
SET "role" = c."role",
    "cpf" = COALESCE(p."cpf", c."document"),
    "phone" = COALESCE(p."phone", c."phone"),
    "email" = COALESCE(p."email", c."email")
FROM "Collaborator" c
WHERE p."collaboratorId" = c."id";

-- Os demais colaboradores viram profissionais que não atendem pacientes
INSERT INTO "Professional" ("id", "name", "role", "cpf", "phone", "email", "notes", "active", "attends", "createdAt", "updatedAt")
SELECT c."id", c."name", c."role", c."document", c."phone", c."email", c."notes", c."active", false, c."createdAt", CURRENT_TIMESTAMP
FROM "Collaborator" c
WHERE NOT EXISTS (SELECT 1 FROM "Professional" p WHERE p."collaboratorId" = c."id");

-- Contratos
ALTER TABLE "Contract" ADD COLUMN "professionalId" TEXT;
UPDATE "Contract" x
SET "professionalId" = COALESCE((SELECT p."id" FROM "Professional" p WHERE p."collaboratorId" = x."collaboratorId"), x."collaboratorId");
ALTER TABLE "Contract" ALTER COLUMN "professionalId" SET NOT NULL;
ALTER TABLE "Contract" DROP COLUMN "collaboratorId";
CREATE INDEX "Contract_professionalId_idx" ON "Contract"("professionalId");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contas a pagar
ALTER TABLE "FinancialEntry" ADD COLUMN "professionalId" TEXT;
UPDATE "FinancialEntry" x
SET "professionalId" = COALESCE((SELECT p."id" FROM "Professional" p WHERE p."collaboratorId" = x."collaboratorId"), x."collaboratorId")
WHERE x."collaboratorId" IS NOT NULL;
ALTER TABLE "FinancialEntry" DROP COLUMN "collaboratorId";
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Estoque
ALTER TABLE "StockMovement" ADD COLUMN "professionalId" TEXT;
UPDATE "StockMovement" x
SET "professionalId" = COALESCE((SELECT p."id" FROM "Professional" p WHERE p."collaboratorId" = x."collaboratorId"), x."collaboratorId")
WHERE x."collaboratorId" IS NOT NULL;
ALTER TABLE "StockMovement" DROP COLUMN "collaboratorId";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fim do cadastro de colaboradores
ALTER TABLE "Professional" DROP COLUMN "collaboratorId";
DROP TABLE "Collaborator";

ALTER TABLE "Evolution" ADD CONSTRAINT "Evolution_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_statusChangedById_fkey" FOREIGN KEY ("statusChangedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
