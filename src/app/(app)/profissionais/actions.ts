"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { checkbox, cpf, digits, email, hexColor, optional, parseForm, required, type FormState } from "@/lib/form";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 150),
  specialty: optional(100),
  registryType: optional(20),
  registryNumber: optional(40),
  cpf: cpf(),
  phone: digits(11),
  email: email(),
  color: hexColor(),
  notes: optional(2000),
  active: checkbox(),
});

export async function saveProfessional(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, ...data } = parsed.data;
  return runAction(formData, async () => {
    if (id) await db.professional.update({ where: { id }, data });
    else await db.professional.create({ data });
    return { redirectTo: "/profissionais" };
  });
}
