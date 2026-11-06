"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, checkbox, parseForm, required, type FormState } from "@/lib/form";
import { unknownVariables } from "@/lib/whatsapp";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 80),
  body: required("Mensagem", 1500),
  isDefault: checkbox(),
  active: checkbox(),
});

export async function saveMessageTemplate(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, name, body, isDefault } = parsed.data;
  // novo modelo nasce ativo (o campo "ativo" só aparece na edição)
  const active = id ? parsed.data.active : true;

  return runAction("CADASTROS", formData, async () => {
    const unknown = unknownVariables(body);
    if (unknown.length > 0) {
      throw new UserError("A mensagem tem variáveis que não existem.", {
        body: `Variável desconhecida: ${unknown.map((u) => `{${u}}`).join(", ")}. Use os botões das variáveis para inserir.`,
      });
    }
    const sameName = await db.messageTemplate.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
    });
    if (sameName) throw new UserError("Já existe um modelo com este nome.", { name: "Nome já cadastrado" });
    if (isDefault && !active) throw new UserError("O modelo padrão precisa estar ativo.", { active: "Ative ou desmarque “padrão”" });

    await db.$transaction(async (tx) => {
      // só um modelo é o padrão
      if (isDefault) await tx.messageTemplate.updateMany({ where: id ? { id: { not: id } } : {}, data: { isDefault: false } });
      if (id) await tx.messageTemplate.update({ where: { id }, data: { name, body, isDefault, active } });
      else await tx.messageTemplate.create({ data: { name, body, isDefault, active } });
    });
    return { redirectTo: "/mensagens" };
  });
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteMessageTemplate(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  const { id } = parsed.data;

  return runAction("CADASTROS", formData, async () => {
    await db.messageTemplate.delete({ where: { id } });
    return { redirectTo: "/mensagens" };
  });
}
