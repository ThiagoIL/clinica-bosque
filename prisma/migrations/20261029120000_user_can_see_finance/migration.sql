-- Permissão individual para ver o financeiro. Quem já existe continua vendo (o perfil de acesso segue valendo).
ALTER TABLE "User" ADD COLUMN "canSeeFinance" BOOLEAN NOT NULL DEFAULT true;
