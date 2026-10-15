import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  const client = globalForPrisma.prisma ?? createClient();
  // Reaproveita a instância em dev (hot reload) e em produção (processo único).
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Cliente do banco criado sob demanda: importar este módulo não exige DATABASE_URL,
 * o que permite `next build` (coleta de dados das rotas) sem acesso ao banco.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
