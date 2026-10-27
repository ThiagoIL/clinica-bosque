"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, checkbox, integer, optionalMoney, parseForm, required, type FormState } from "@/lib/form";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 120),
  particularPrice: optionalMoney(),
  durationMinutes: integer("Duração", 5, 600),
  active: checkbox(),
});

export async function saveService(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, particularPrice, ...data } = parsed.data;
  return runAction("CADASTROS", formData, async () => {
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

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteService(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  const { id } = parsed.data;

  return runAction("CADASTROS", formData, async () => {
    const [engagements, appointments] = await Promise.all([
      db.engagement.count({ where: { serviceId: id } }),
      db.appointment.count({ where: { serviceId: id } }),
    ]);
    if (engagements + appointments > 0) {
      throw new UserError(
        `Este serviço já foi usado em ${engagements} lançamento(s) e não pode ser excluído. Desative o serviço em vez disso.`,
      );
    }
    // os preços da tabela do serviço são removidos junto (cascade)
    await db.service.delete({ where: { id } });
    return { redirectTo: "/servicos" };
  });
}
