import "server-only";
import { db } from "@/lib/db";
import type { EntryKind } from "@/generated/prisma/enums";

export type EntryKindSlug = "receber" | "pagar";

export const kindFromSlug = (slug: string): EntryKind | null =>
  slug === "receber" ? "INCOME" : slug === "pagar" ? "EXPENSE" : null;

export const slugFromKind = (kind: EntryKind): EntryKindSlug => (kind === "INCOME" ? "receber" : "pagar");

export async function getFinanceOptions(kind?: EntryKind) {
  const [accounts, categories] = await Promise.all([
    db.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.financialCategory.findMany({
      where: { active: true, ...(kind ? { kind } : {}) },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    accounts: accounts.map((a) => ({ value: a.id, label: a.name })),
    categories: categories.map((c) => ({ value: c.id, label: c.name })),
  };
}

/** Saldo (inicial + movimentações pagas até a data, exclusive) das contas informadas. */
export async function balanceBefore(date: Date, accountId?: string) {
  const accounts = await db.financialAccount.findMany({
    where: accountId ? { id: accountId } : {},
    select: { id: true, initialBalanceCents: true },
  });
  const ids = accounts.map((a) => a.id);
  const grouped = await db.financialEntry.groupBy({
    by: ["kind"],
    where: { status: "PAID", accountId: { in: ids }, paidOn: { lt: date } },
    _sum: { paidAmountCents: true },
  });
  const initial = accounts.reduce((s, a) => s + a.initialBalanceCents, 0);
  const income = grouped.find((g) => g.kind === "INCOME")?._sum.paidAmountCents ?? 0;
  const expense = grouped.find((g) => g.kind === "EXPENSE")?._sum.paidAmountCents ?? 0;
  return initial + income - expense;
}
