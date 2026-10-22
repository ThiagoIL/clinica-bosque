"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { parseMoney } from "@/lib/money";
import { UserError, checkbox, parseForm, selectId, type FormState } from "@/lib/form";

const planSchema = z.object({ planId: selectId("o plano") });

/** Salva a tabela de preços de um plano. Campos: s_<serviceId> e p_<itemId>; vazio = sem preço. */
export async function savePriceTable(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(planSchema, formData);
  if (parsed.state) return parsed.state;
  const { planId } = parsed.data;

  const services: { id: string; cents: number }[] = [];
  const products: { id: string; cents: number }[] = [];
  const serviceIds: string[] = [];
  const productIds: string[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string" || !/^[sp]_/.test(key)) continue;
    const id = key.slice(2);
    const isService = key.startsWith("s_");
    (isService ? serviceIds : productIds).push(id);
    if (!raw.trim()) continue;
    const cents = parseMoney(raw);
    if (cents === null || cents < 0) {
      fieldErrors[key] = "Valor inválido";
      continue;
    }
    (isService ? services : products).push({ id, cents });
  }
  if (Object.keys(fieldErrors).length) {
    return { error: "Há valores inválidos na tabela.", fieldErrors, values: Object.fromEntries(formData) as Record<string, string> };
  }

  return runAction("CADASTROS", formData, async () => {
    const plan = await db.healthPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new UserError("Plano não encontrado.");

    await db.$transaction([
      db.servicePrice.deleteMany({ where: { healthPlanId: planId, serviceId: { in: serviceIds } } }),
      db.servicePrice.createMany({
        data: services.map((s) => ({ serviceId: s.id, healthPlanId: planId, priceCents: s.cents })),
      }),
      db.productPrice.deleteMany({ where: { healthPlanId: planId, stockItemId: { in: productIds } } }),
      db.productPrice.createMany({
        data: products.map((p) => ({ stockItemId: p.id, healthPlanId: planId, priceCents: p.cents })),
      }),
    ]);
    return { success: `Tabela de preços de ${plan.name} salva.` };
  });
}

const copySchema = z.object({
  planId: selectId("o plano de destino"),
  sourceId: selectId("o plano de origem"),
  percent: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return 0;
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n) || n < -100 || n > 1000) {
        ctx.addIssue({ code: "custom", message: "Percentual inválido" });
        return z.NEVER;
      }
      return n;
    }),
  overwrite: checkbox(),
});

/** Copia os preços de outro plano, com ajuste percentual opcional (ex.: -10 para 10% a menos). */
export async function copyPriceTable(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(copySchema, formData);
  if (parsed.state) return parsed.state;
  const { planId, sourceId, percent, overwrite } = parsed.data;

  return runAction("CADASTROS", formData, async () => {
    if (planId === sourceId) throw new UserError("Escolha um plano de origem diferente do destino.");
    const factor = 1 + percent / 100;
    const [servicePrices, productPrices, targetServices, targetProducts] = await Promise.all([
      db.servicePrice.findMany({ where: { healthPlanId: sourceId } }),
      db.productPrice.findMany({ where: { healthPlanId: sourceId } }),
      db.servicePrice.findMany({ where: { healthPlanId: planId }, select: { serviceId: true } }),
      db.productPrice.findMany({ where: { healthPlanId: planId }, select: { stockItemId: true } }),
    ]);
    const haveServices = new Set(targetServices.map((p) => p.serviceId));
    const haveProducts = new Set(targetProducts.map((p) => p.stockItemId));
    const sp = servicePrices.filter((p) => overwrite || !haveServices.has(p.serviceId));
    const pp = productPrices.filter((p) => overwrite || !haveProducts.has(p.stockItemId));

    await db.$transaction([
      db.servicePrice.deleteMany({ where: { healthPlanId: planId, serviceId: { in: sp.map((p) => p.serviceId) } } }),
      db.servicePrice.createMany({
        data: sp.map((p) => ({ serviceId: p.serviceId, healthPlanId: planId, priceCents: Math.max(0, Math.round(p.priceCents * factor)) })),
      }),
      db.productPrice.deleteMany({ where: { healthPlanId: planId, stockItemId: { in: pp.map((p) => p.stockItemId) } } }),
      db.productPrice.createMany({
        data: pp.map((p) => ({ stockItemId: p.stockItemId, healthPlanId: planId, priceCents: Math.max(0, Math.round(p.priceCents * factor)) })),
      }),
    ]);
    return { success: `${sp.length + pp.length} preço(s) copiado(s).` };
  });
}
