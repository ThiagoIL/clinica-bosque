"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { dateOnly, todayString } from "@/lib/dates";
import {
  UserError, checkbox, dateField, integer, optional, optionalDate, optionalId, optionalInteger,
  optionalMoney, parseForm, required, requiredEnum, selectId, type FormState,
} from "@/lib/form";

const itemSchema = z.object({
  id: z.string().optional(),
  name: required("Nome", 150),
  sku: optional(50),
  unit: required("Unidade", 15),
  category: optional(60),
  minQuantity: integer("Estoque mínimo", 0, 1_000_000),
  cost: optionalMoney(),
  initialQuantity: optionalInteger("Quantidade inicial", 0, 1_000_000),
  notes: optional(1000),
  active: checkbox(),
});

export async function saveStockItem(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(itemSchema, formData);
  if (parsed.state) return parsed.state;
  const { id, cost, initialQuantity, ...rest } = parsed.data;

  return runAction(formData, async () => {
    if (id) {
      await db.stockItem.update({ where: { id }, data: { ...rest, costCents: cost ?? 0 } });
    } else {
      await db.$transaction(async (tx) => {
        const item = await tx.stockItem.create({
          data: { ...rest, costCents: cost ?? 0, quantity: initialQuantity ?? 0 },
        });
        if (initialQuantity && initialQuantity > 0) {
          await tx.stockMovement.create({
            data: {
              itemId: item.id,
              type: "ADJUSTMENT",
              quantity: initialQuantity,
              balanceAfter: initialQuantity,
              reason: "Estoque inicial",
              occurredOn: dateOnly(todayString()),
            },
          });
        }
      });
    }
    return { redirectTo: "/estoque" };
  });
}

const movementSchema = z.object({
  itemId: selectId("o item"),
  type: requiredEnum(["IN", "OUT", "ADJUSTMENT"], "Tipo"),
  quantity: integer("Quantidade", 0, 1_000_000),
  unitCost: optionalMoney(),
  supplierId: optionalId(),
  occurredOn: dateField("Data"),
  reason: optional(300),
  createPayable: checkbox(),
  dueDate: optionalDate("Vencimento"),
});

export async function registerMovement(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(movementSchema, formData);
  if (parsed.state) return parsed.state;
  const d = parsed.data;

  return runAction(formData, async () => {
    if (d.type !== "ADJUSTMENT" && d.quantity <= 0) {
      throw new UserError("A quantidade deve ser maior que zero.", { quantity: "Informe uma quantidade maior que zero" });
    }

    await db.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({ where: { id: d.itemId } });
      if (!item) throw new UserError("Item não encontrado.");

      let delta: number;
      if (d.type === "IN") delta = d.quantity;
      else if (d.type === "OUT") delta = -d.quantity;
      else delta = d.quantity - item.quantity; // ajuste: informa o saldo contado

      if (delta === 0 && d.type === "ADJUSTMENT") throw new UserError("O saldo informado é igual ao saldo atual.");

      // Atualização condicional: impede saldo negativo mesmo com movimentações simultâneas.
      const updated = await tx.stockItem.updateMany({
        where: { id: item.id, ...(delta < 0 ? { quantity: { gte: -delta } } : {}) },
        data: { quantity: { increment: delta }, ...(d.type === "IN" && d.unitCost ? { costCents: d.unitCost } : {}) },
      });
      if (updated.count === 0) {
        throw new UserError(`Saldo insuficiente: há ${item.quantity} ${item.unit} em estoque.`, { quantity: "Saldo insuficiente" });
      }
      const after = await tx.stockItem.findUniqueOrThrow({ where: { id: item.id }, select: { quantity: true } });

      let entryId: string | null = null;
      if (d.type === "IN" && d.createPayable) {
        if (!d.unitCost) throw new UserError("Informe o custo unitário para gerar a conta a pagar.", { unitCost: "Informe o custo" });
        const category = await tx.financialCategory.findFirst({ where: { name: "Materiais e estoque", kind: "EXPENSE" } });
        const entry = await tx.financialEntry.create({
          data: {
            kind: "EXPENSE",
            description: `Compra de estoque: ${item.name} (${d.quantity} ${item.unit})`,
            amountCents: d.unitCost * d.quantity,
            dueDate: dateOnly(d.dueDate ?? d.occurredOn),
            supplierId: d.supplierId,
            categoryId: category?.id ?? null,
          },
        });
        entryId = entry.id;
      }

      await tx.stockMovement.create({
        data: {
          itemId: item.id,
          type: d.type,
          quantity: delta,
          balanceAfter: after.quantity,
          unitCostCents: d.type === "IN" ? d.unitCost : null,
          supplierId: d.type === "IN" ? d.supplierId : null,
          entryId,
          reason: d.reason,
          occurredOn: dateOnly(d.occurredOn),
        },
      });
    });
    return { success: "Movimentação registrada." };
  });
}
