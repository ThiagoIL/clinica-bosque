-- Fornecedores viram "Colaboradores" (mesmos dados, nova função) e ganham contratos com anexos.

-- Renomeia Supplier -> Collaborator, mantendo todos os registros e vínculos
ALTER TABLE "Supplier" RENAME TO "Collaborator";
ALTER TABLE "Collaborator" RENAME CONSTRAINT "Supplier_pkey" TO "Collaborator_pkey";
ALTER TABLE "Collaborator" ADD COLUMN "role" TEXT;

ALTER TABLE "FinancialEntry" RENAME COLUMN "supplierId" TO "collaboratorId";
ALTER TABLE "FinancialEntry" RENAME CONSTRAINT "FinancialEntry_supplierId_fkey" TO "FinancialEntry_collaboratorId_fkey";

ALTER TABLE "StockMovement" RENAME COLUMN "supplierId" TO "collaboratorId";
ALTER TABLE "StockMovement" RENAME CONSTRAINT "StockMovement_supplierId_fkey" TO "StockMovement_collaboratorId_fkey";

-- Contratos e anexos
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "valueCents" INTEGER,
    "valueNote" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "endedOn" DATE,
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractFile" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contract_status_endDate_idx" ON "Contract"("status", "endDate");
CREATE INDEX "Contract_collaboratorId_idx" ON "Contract"("collaboratorId");
CREATE INDEX "ContractFile_contractId_idx" ON "ContractFile"("contractId");

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Libera o novo módulo "Colaboradores e contratos" nas instalacoes existentes
UPDATE "SystemSettings"
SET "enabledModules" = array_append("enabledModules", 'CONTRATOS')
WHERE NOT ('CONTRATOS' = ANY("enabledModules"));
