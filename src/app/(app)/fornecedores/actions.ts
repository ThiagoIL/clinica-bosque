"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { checkbox, digits, email, optional, parseForm, required, type FormState } from "@/lib/form";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 150),
  document: digits(14),
  phone: digits(11),
  email: email(),
  notes: optional(2000),
  active: checkbox(),
});

export async function saveSupplier(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, ...data } = parsed.data;
  return runAction(formData, async () => {
    if (id) await db.supplier.update({ where: { id }, data });
    else await db.supplier.create({ data });
    return { redirectTo: "/fornecedores" };
  });
}
