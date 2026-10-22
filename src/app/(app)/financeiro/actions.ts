"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { addMonths, dateOnly, todayString } from "@/lib/dates";
import { splitCents } from "@/lib/money";
import {
  UserError, checkbox, dateField, integer, money, optional, optionalDate, optionalEnum, optionalId,
  optionalMoney, parseForm, required, requiredEnum, selectId, type FormState,
} from "@/lib/form";

const PAYMENT = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "BANK_SLIP", "TRANSFER", "HEALTH_INSURANCE", "OTHER"] as const;
const KIND = ["INCOME", "EXPENSE"] as const;

const createSchema = z.object({
  kind: requiredEnum(KIND, "Tipo"),
  description: required("Descrição", 200),
  amount: money("Valor"),
  dueDate: dateField("Vencimento"),
  categoryId: optionalId(),
  patientId: optionalId(),
  supplierId: optionalId(),
  installments: integer("Parcelas", 1, 60),
  notes: optional(1000),
  paidNow: checkbox(),
  paidOn: optionalDate("Data do pagamento"),
  accountId: optionalId(),
  paymentMethod: optionalEnum(PAYMENT),
});

export async function createEntry(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(createSchema, formData);
  if (parsed.state) return parsed.state;
  const d = parsed.data;
  const path = d.kind === "INCOME" ? "receber" : "pagar";

  return runAction("FINANCEIRO", formData, async () => {
    if (d.paidNow) {
      if (d.installments > 1) throw new UserError("Lançamento já pago não pode ser parcelado.");
      if (!d.accountId) throw new UserError("Selecione a conta onde o pagamento foi realizado.", { accountId: "Selecione a conta" });
    }
    const amounts = splitCents(d.amount, d.installments);
    const baseDue = d.dueDate;

    await db.financialEntry.createMany({
      data: amounts.map((amountCents, i) => ({
        kind: d.kind,
        description: d.installments > 1 ? `${d.description} (${i + 1}/${d.installments})` : d.description,
        amountCents,
        dueDate: dateOnly(addMonths(baseDue, i)),
        categoryId: d.categoryId,
        patientId: d.kind === "INCOME" ? d.patientId : null,
        supplierId: d.kind === "EXPENSE" ? d.supplierId : null,
        installmentNumber: d.installments > 1 ? i + 1 : null,
        installmentTotal: d.installments > 1 ? d.installments : null,
        notes: d.notes,
        ...(d.paidNow
          ? {
              status: "PAID" as const,
              paidOn: dateOnly(d.paidOn ?? todayString()),
              paidAmountCents: amountCents,
              accountId: d.accountId,
              paymentMethod: d.paymentMethod,
            }
          : {}),
      })),
    });
    return { redirectTo: `/financeiro/${path}` };
  });
}

const updateSchema = z.object({
  id: selectId("o lançamento"),
  description: required("Descrição", 200),
  amount: money("Valor"),
  dueDate: dateField("Vencimento"),
  categoryId: optionalId(),
  patientId: optionalId(),
  supplierId: optionalId(),
  notes: optional(1000),
});

export async function updateEntry(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(updateSchema, formData);
  if (parsed.state) return parsed.state;
  const d = parsed.data;
  return runAction("FINANCEIRO", formData, async () => {
    const entry = await db.financialEntry.findUnique({ where: { id: d.id } });
    if (!entry) throw new UserError("Lançamento não encontrado.");
    if (entry.status !== "PENDING") throw new UserError("Somente lançamentos em aberto podem ser editados. Reabra o lançamento primeiro.");
    await db.financialEntry.update({
      where: { id: d.id },
      data: {
        description: d.description,
        amountCents: d.amount,
        dueDate: dateOnly(d.dueDate),
        categoryId: d.categoryId,
        patientId: entry.kind === "INCOME" ? d.patientId : null,
        supplierId: entry.kind === "EXPENSE" ? d.supplierId : null,
        notes: d.notes,
      },
    });
    return { success: "Lançamento atualizado." };
  });
}

const settleSchema = z.object({
  id: selectId("o lançamento"),
  paidOn: dateField("Data do pagamento"),
  paidAmount: optionalMoney(),
  accountId: selectId("a conta"),
  paymentMethod: optionalEnum(PAYMENT),
});

export async function settleEntry(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(settleSchema, formData);
  if (parsed.state) return parsed.state;
  const d = parsed.data;
  return runAction("FINANCEIRO", formData, async () => {
    const entry = await db.financialEntry.findUnique({ where: { id: d.id } });
    if (!entry) throw new UserError("Lançamento não encontrado.");
    if (entry.status !== "PENDING") throw new UserError("Este lançamento não está em aberto.");
    await db.financialEntry.update({
      where: { id: d.id },
      data: {
        status: "PAID",
        paidOn: dateOnly(d.paidOn),
        paidAmountCents: d.paidAmount ?? entry.amountCents,
        accountId: d.accountId,
        paymentMethod: d.paymentMethod,
      },
    });
    return { success: entry.kind === "INCOME" ? "Recebimento registrado." : "Pagamento registrado." };
  });
}

const idSchema = z.object({ id: selectId("o lançamento") });

export async function reopenEntry(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction("FINANCEIRO", formData, async () => {
    await db.financialEntry.update({
      where: { id: parsed.data.id },
      data: { status: "PENDING", paidOn: null, paidAmountCents: null, accountId: null, paymentMethod: null },
    });
    return { success: "Lançamento reaberto." };
  });
}

export async function cancelEntry(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction("FINANCEIRO", formData, async () => {
    const entry = await db.financialEntry.findUnique({ where: { id: parsed.data.id } });
    if (!entry) throw new UserError("Lançamento não encontrado.");
    if (entry.status === "PAID") throw new UserError("Reabra o lançamento antes de cancelar.");
    await db.financialEntry.update({ where: { id: entry.id }, data: { status: "CANCELED" } });
    return { redirectTo: `/financeiro/${entry.kind === "INCOME" ? "receber" : "pagar"}` };
  });
}
