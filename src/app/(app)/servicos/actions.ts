"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { checkbox, integer, optionalMoney, parseForm, required, requiredEnum, type FormState } from "@/lib/form";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 120),
  kind: requiredEnum(["CONSULTATION", "RETURN", "SESSION", "THERAPY", "EXAM", "OTHER"], "Tipo"),
  particularPrice: optionalMoney(),
  durationMinutes: integer("Duração", 5, 600),
  active: checkbox(),
});

export async function saveService(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, particularPrice, ...data } = parsed.data;
  return runAction(formData, async () => {
    const service = id
      ? await db.service.update({ where: { id }, data })
      : await db.service.create({ data });

    // O valor informado aqui é o preço do plano Particular; os demais planos ficam na tabela de preços.
    const particular = await db.healthPlan.findFirst({ where: { isDefault: true } });
    if (particular && particularPrice !== null) {
      await db.servicePrice.upsert({
        where: { serviceId_healthPlanId: { serviceId: service.id, healthPlanId: particular.id } },
        update: { priceCents: particularPrice },
        create: { serviceId: service.id, healthPlanId: particular.id, priceCents: particularPrice },
      });
    }
    return { redirectTo: id ? "/servicos" : "/precos" };
  });
}
