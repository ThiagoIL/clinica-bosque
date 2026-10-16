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

  // Planos de saúde: o "Particular" sempre existe (o app também o cria ao iniciar).
  const particular =
    (await db.healthPlan.findFirst({ where: { isDefault: true } })) ??
    (await db.healthPlan.create({ data: { name: "Particular", isDefault: true } }));
  const unimed = await db.healthPlan.create({ data: { name: "Unimed" } });
  const bradesco = await db.healthPlan.create({ data: { name: "Bradesco Saúde" } });

  // [nome, tipo, duração (min), preço Particular, preço Unimed, preço Bradesco] (centavos)
  const catalog = [
    ["Consulta médica", "CONSULTATION", 40, 25000, 18000, 17000],
    ["Retorno médico", "RETURN", 30, 0, 0, 0],
    ["Sessão de psicoterapia", "SESSION", 50, 15000, 11000, 10500],
    ["Fisioterapia", "THERAPY", 45, 12000, 8500, 8000],
    ["Avaliação inicial", "EXAM", 60, 20000, 14000, 13500],
  ] as const;
  for (const [name, kind, durationMinutes, p0, p1, p2] of catalog) {
    const service = await db.service.create({ data: { name, kind, durationMinutes } });
    await db.servicePrice.createMany({
      data: [
        { serviceId: service.id, healthPlanId: particular.id, priceCents: p0 },
        { serviceId: service.id, healthPlanId: unimed.id, priceCents: p1 },
        { serviceId: service.id, healthPlanId: bradesco.id, priceCents: p2 },
      ],
    });
  }

  await db.patient.createMany({
    data: [
      { name: "Ana Beatriz Lima", phone: "11987654321", email: "ana@example.com", healthPlanId: particular.id },
      { name: "Bruno Carvalho", phone: "11976543210", healthPlanId: unimed.id },
      { name: "Carla Mendes", phone: "11965432109", healthPlanId: particular.id },
      { name: "Diego Santos", phone: "11954321098", healthPlanId: bradesco.id },
      { name: "Elisa Ferreira", phone: "11943210987", healthPlanId: particular.id },
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
