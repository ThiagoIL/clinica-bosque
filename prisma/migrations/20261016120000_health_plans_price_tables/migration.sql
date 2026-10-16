-- CreateEnum
CREATE TYPE "RepeatEnd" AS ENUM ('COUNT', 'UNTIL_DATE', 'UNTIL_MONTH');

-- AlterEnum
ALTER TYPE "ServiceKind" ADD VALUE 'RETURN';

-- AlterTable
ALTER TABLE "Engagement" ADD COLUMN     "healthPlanId" TEXT,
ADD COLUMN     "repeatEnd" "RepeatEnd" NOT NULL DEFAULT 'COUNT',
ADD COLUMN     "untilDate" DATE,
ADD COLUMN     "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Engagement" ALTER COLUMN "weekdays" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "healthPlanId" TEXT;

-- CreateTable
CREATE TABLE "HealthPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePrice" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "healthPlanId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "healthPlanId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthPlan_name_key" ON "HealthPlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePrice_serviceId_healthPlanId_key" ON "ServicePrice"("serviceId", "healthPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPrice_stockItemId_healthPlanId_key" ON "ProductPrice"("stockItemId", "healthPlanId");

-- CreateIndex
CREATE INDEX "Patient_healthPlanId_idx" ON "Patient"("healthPlanId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePrice" ADD CONSTRAINT "ServicePrice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePrice" ADD CONSTRAINT "ServicePrice_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------- Migração dos dados existentes -------------

-- Plano padrão "Particular"
INSERT INTO "HealthPlan" ("id", "name", "isDefault")
VALUES (gen_random_uuid()::text, 'Particular', true);

-- Um plano para cada convênio já digitado em texto livre nos pacientes
INSERT INTO "HealthPlan" ("id", "name")
SELECT gen_random_uuid()::text, MIN(TRIM("healthInsurance"))
FROM "Patient"
WHERE "healthInsurance" IS NOT NULL
  AND TRIM("healthInsurance") <> ''
  AND LOWER(TRIM("healthInsurance")) <> 'particular'
GROUP BY LOWER(TRIM("healthInsurance"));

-- Vincula cada paciente ao seu plano (sem convênio informado = Particular)
UPDATE "Patient" p
SET "healthPlanId" = hp."id"
FROM "HealthPlan" hp
WHERE LOWER(hp."name") = LOWER(COALESCE(NULLIF(TRIM(p."healthInsurance"), ''), 'Particular'));

-- O valor padrão de cada serviço vira o preço do plano Particular
INSERT INTO "ServicePrice" ("id", "serviceId", "healthPlanId", "priceCents", "updatedAt")
SELECT gen_random_uuid()::text, s."id", hp."id", s."defaultPriceCents", CURRENT_TIMESTAMP
FROM "Service" s
CROSS JOIN "HealthPlan" hp
WHERE hp."isDefault" = true;

-- Lançamentos existentes herdam o plano do paciente
UPDATE "Engagement" e
SET "healthPlanId" = p."healthPlanId"
FROM "Patient" p
WHERE p."id" = e."patientId";

-- Colunas antigas, agora substituídas
ALTER TABLE "Patient" DROP COLUMN "healthInsurance";
ALTER TABLE "Service" DROP COLUMN "defaultPriceCents";
