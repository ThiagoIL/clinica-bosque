"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, checkbox, digits, email, optional, parseForm, required, type FormState } from "@/lib/form";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome", 150),
  role: optional(100),
  document: digits(14),
  phone: digits(11),
  email: email(),
  notes: optional(2000),
  active: checkbox(),
});

export async function saveCollaborator(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, ...data } = parsed.data;
  return runAction("CONTRATOS", formData, async () => {
    if (id) await db.collaborator.update({ where: { id }, data });
    else await db.collaborator.create({ data });
    return { redirectTo: "/colaboradores" };
  });
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteCollaborator(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  const { id } = parsed.data;

  return runAction("CONTRATOS", formData, async () => {
    const [contracts, entries, movements] = await Promise.all([
      db.contract.count({ where: { collaboratorId: id } }),
      db.financialEntry.count({ where: { collaboratorId: id } }),
      db.stockMovement.count({ where: { collaboratorId: id } }),
    ]);
    if (contracts > 0) {
      throw new UserError(
        `Este colaborador tem ${contracts} contrato(s) e não pode ser excluído. Desative o cadastro em vez disso.`,
      );
    }
    if (entries + movements > 0) {
      throw new UserError(
        "Este colaborador está em contas a pagar ou movimentações de estoque e não pode ser excluído. Desative o cadastro em vez disso.",
      );
    }
    // o vínculo com o profissional (se houver) é desfeito automaticamente
    await db.collaborator.delete({ where: { id } });
    return { redirectTo: "/colaboradores" };
  });
}
