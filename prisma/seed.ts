/**
 * Dados de demonstração (opcional): `npm run db:seed`.
 * Só insere quando ainda não existem pacientes, então é seguro rodar mais de uma vez.
 * O administrador, as categorias e a conta "Caixa" são criados pelo próprio app na inicialização.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  if ((await db.patient.count()) > 0) {
    console.log("Já existem pacientes; seed ignorado.");
    return;
  }

  await db.professional.createMany({
    data: [
      { name: "Dra. Helena Duarte", specialty: "Psiquiatria", registryType: "CRM", registryNumber: "12345-SP", color: "#2f8f68" },
      { name: "Dr. Marcos Ribeiro", specialty: "Psicologia", registryType: "CRP", registryNumber: "06/98765", color: "#3b82f6" },
      { name: "Dra. Camila Torres", specialty: "Fisioterapia", registryType: "CREFITO", registryNumber: "54321-F", color: "#d97706" },
    ],
  });

  await db.service.createMany({
    data: [
      { name: "Consulta médica", kind: "CONSULTATION", defaultPriceCents: 25000, durationMinutes: 40 },
      { name: "Sessão de psicoterapia", kind: "SESSION", defaultPriceCents: 15000, durationMinutes: 50 },
      { name: "Fisioterapia", kind: "THERAPY", defaultPriceCents: 12000, durationMinutes: 45 },
      { name: "Avaliação inicial", kind: "EXAM", defaultPriceCents: 20000, durationMinutes: 60 },
    ],
  });

  await db.patient.createMany({
    data: [
      { name: "Ana Beatriz Lima", phone: "11987654321", email: "ana@example.com", healthInsurance: "Particular" },
      { name: "Bruno Carvalho", phone: "11976543210", healthInsurance: "Unimed" },
      { name: "Carla Mendes", phone: "11965432109" },
      { name: "Diego Santos", phone: "11954321098", healthInsurance: "Bradesco Saúde" },
      { name: "Elisa Ferreira", phone: "11943210987" },
    ],
  });

  await db.supplier.createMany({
    data: [
      { name: "Papelaria Central", phone: "1133334444" },
      { name: "MedSupply Distribuidora", phone: "1144445555", email: "vendas@medsupply.example" },
    ],
  });

  await db.stockItem.createMany({
    data: [
      { name: "Luvas descartáveis (caixa)", sku: "LUV-001", unit: "cx", minQuantity: 5, quantity: 12, costCents: 3200 },
      { name: "Álcool 70% 1L", sku: "ALC-070", unit: "un", minQuantity: 6, quantity: 3, costCents: 950 },
      { name: "Lençol descartável (rolo)", sku: "LEN-010", unit: "un", minQuantity: 4, quantity: 8, costCents: 2800 },
    ],
  });

  console.log("Dados de demonstração criados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
