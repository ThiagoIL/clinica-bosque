"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { checkbox, parseForm, required, requiredEnum, type FormState } from "@/lib/form";
import { parseMoney } from "@/lib/money";

const accountSchema = z.object({
  id: z.string().optional(),
  name: required("Nome", 80),
  type: requiredEnum(["CASH", "BANK", "OTHER"], "Tipo"),
  initialBalance: z.string().optional(),
  active: checkbox(),
});

export async function saveAccount(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(accountSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, initialBalance, ...rest } = parsed.data;
  const cents = initialBalance?.trim() ? parseMoney(initialBalance) : 0;
  if (cents === null) {
    return { error: "Verifique os campos destacados.", fieldErrors: { initialBalance: "Saldo inicial inválido" }, values: Object.fromEntries(formData) as Record<string, string> };
  }
  return runAction("FINANCEIRO", formData, async () => {
    const data = { ...rest, initialBalanceCents: cents };
    if (id) await db.financialAccount.update({ where: { id }, data });
    else await db.financialAccount.create({ data });
    return { redirectTo: "/financeiro/contas" };
  });
}

const categorySchema = z.object({
  id: z.string().optional(),
  name: required("Nome", 80),
  kind: requiredEnum(["INCOME", "EXPENSE"], "Tipo"),
  active: checkbox(),
});

export async function saveCategory(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(categorySchema, formData);
  if (parsed.state) return parsed.state;
  const { id, ...data } = parsed.data;
  return runAction("FINANCEIRO", formData, async () => {
    if (id) await db.financialCategory.update({ where: { id }, data });
    else await db.financialCategory.create({ data });
    return { redirectTo: "/financeiro/contas" };
  });
}
