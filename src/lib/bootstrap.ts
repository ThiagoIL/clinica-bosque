import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const DEFAULT_CATEGORIES = [
  { name: "Atendimentos", kind: "INCOME" },
  { name: "Outras receitas", kind: "INCOME" },
  { name: "Aluguel", kind: "EXPENSE" },
  { name: "Salários e repasses", kind: "EXPENSE" },
  { name: "Materiais e estoque", kind: "EXPENSE" },
  { name: "Impostos e taxas", kind: "EXPENSE" },
  { name: "Serviços (água, luz, internet)", kind: "EXPENSE" },
  { name: "Outras despesas", kind: "EXPENSE" },
] as const;

/**
 * Preparação idempotente executada ao iniciar o servidor:
 * cria o administrador (a partir das variáveis de ambiente) quando ainda não há usuários
 * e garante categorias e a conta "Caixa" padrão.
 */
export async function bootstrap() {
  const users = await db.user.count();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (users === 0) {
    if (email && password) {
      await db.user.create({
        data: {
          name: process.env.ADMIN_NAME?.trim() || "Administrador",
          email,
          passwordHash: await bcrypt.hash(password, 12),
          role: "ADMIN",
        },
      });
      console.log(`[bootstrap] administrador criado: ${email}`);
    } else {
      console.warn("[bootstrap] nenhum usuário existe e ADMIN_EMAIL/ADMIN_PASSWORD não foram definidos");
    }
  }

  if ((await db.financialCategory.count()) === 0) {
    await db.financialCategory.createMany({ data: DEFAULT_CATEGORIES.map((c) => ({ ...c })), skipDuplicates: true });
  }
  if ((await db.financialAccount.count()) === 0) {
    await db.financialAccount.create({ data: { name: "Caixa", type: "CASH" } });
  }
}
