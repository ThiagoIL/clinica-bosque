-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessProfileId" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AccessProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockMessage" TEXT,
    "blockedAt" TIMESTAMP(3),
    "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "adminEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessProfile_name_key" ON "AccessProfile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

-- CreateIndex
CREATE INDEX "PlatformEvent_createdAt_idx" ON "PlatformEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessProfileId_fkey" FOREIGN KEY ("accessProfileId") REFERENCES "AccessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----- Dados iniciais para instalações existentes -----

-- Configuração do sistema: tudo liberado, exceto Estoque (a clinica nao usa)
INSERT INTO "SystemSettings" ("id", "enabledModules", "updatedAt")
VALUES ('singleton', ARRAY['AGENDA','LANCAMENTOS','PACIENTES','PROFISSIONAIS','FINANCEIRO','CADASTROS'], CURRENT_TIMESTAMP);

-- Os usuarios que ja existiam (perfil "Atendimento") mantem o acesso que tinham
INSERT INTO "AccessProfile" ("id", "name", "permissions", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Atendimento',
  '{"AGENDA":"EDIT","LANCAMENTOS":"EDIT","PACIENTES":"EDIT","PROFISSIONAIS":"EDIT","FINANCEIRO":"EDIT","CADASTROS":"EDIT","ESTOQUE":"EDIT"}'::jsonb,
  CURRENT_TIMESTAMP
);

UPDATE "User"
SET "accessProfileId" = (SELECT "id" FROM "AccessProfile" WHERE "name" = 'Atendimento')
WHERE "role" = 'STAFF';

