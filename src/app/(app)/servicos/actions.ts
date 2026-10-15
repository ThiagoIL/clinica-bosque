"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { checkbox, integer, money, parseForm, requiredEnum, required, type FormState } from "@/lib/form";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 120),
  kind: requiredEnum(["CONSULTATION", "SESSION", "THERAPY", "EXAM", "OTHER"], "Tipo"),
  defaultPrice: money("Valor padrão", { allowZero: true }),
  durationMinutes: integer("Duração", 5, 600),
  active: checkbox(),
});

export async function saveService(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, defaultPrice, ...rest } = parsed.data;
  return runAction(formData, async () => {
    const data = { ...rest, defaultPriceCents: defaultPrice };
    if (id) await db.service.update({ where: { id }, data });
    else await db.service.create({ data });
    return { redirectTo: "/servicos" };
  });
}
