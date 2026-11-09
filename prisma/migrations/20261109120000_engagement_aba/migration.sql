-- Lançamento de paciente ABA (cérebro na agenda e filtro ABA). Os lançamentos existentes ficam como não ABA.
ALTER TABLE "Engagement" ADD COLUMN "aba" BOOLEAN NOT NULL DEFAULT false;
