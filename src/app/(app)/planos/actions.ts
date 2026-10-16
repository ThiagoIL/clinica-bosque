"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, checkbox, optional, parseForm, required, type FormState } from "@/lib/form";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 100),
  notes: optional(1000),
  active: checkbox(),
});

export async function saveHealthPlan(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, name, notes, active } = parsed.data;

  return runAction(formData, async () => {
    const sameName = await db.healthPlan.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
    });
    if (sameName) throw new UserError("Já existe um plano com este nome.", { name: "Nome já cadastrado" });

    if (id) {
      const plan = await db.healthPlan.findUnique({ where: { id } });
      if (!plan) throw new UserError("Plano não encontrado.");
      if (plan.isDefault) {
        // o plano Particular não pode ser renomeado nem desativado
        await db.healthPlan.update({ where: { id }, data: { notes } });
      } else {
        await db.healthPlan.update({ where: { id }, data: { name, notes, active } });
      }
    } else {
      const created = await db.healthPlan.create({ data: { name, notes } });
      return { redirectTo: `/precos?plan=${created.id}` };
    }
    return { redirectTo: "/planos" };
  });
}
