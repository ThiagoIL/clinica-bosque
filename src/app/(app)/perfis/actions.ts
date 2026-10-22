"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { UserError, parseForm, required, selectId, type FormState } from "@/lib/form";
import { MODULE_KEYS, parseEnabledModules, parsePermissions, type Permissions } from "@/lib/modules";

const schema = z.object({
  id: z.string().optional(),
  name: required("Nome do perfil", 80),
});

export async function saveAccessProfile(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(schema, formData);
  if (parsed.state) return parsed.state;
  const { id, name } = parsed.data;

  return runAction("ADMIN", formData, async () => {
    const same = await db.accessProfile.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
    });
    if (same) throw new UserError("Já existe um perfil com este nome.", { name: "Nome já cadastrado" });

    const settings = await db.systemSettings.findUnique({ where: { id: "singleton" } });
    const enabled = settings ? parseEnabledModules(settings.enabledModules) : [];
    const current = id ? await db.accessProfile.findUnique({ where: { id } }) : null;
    if (id && !current) throw new UserError("Perfil não encontrado.");

    // Mantém o que já estava salvo para módulos desligados pelo fornecedor; atualiza os visíveis.
    const permissions: Permissions = current ? parsePermissions(current.permissions) : {};
    for (const key of MODULE_KEYS) {
      if (!enabled.includes(key)) continue;
      const level = formData.get(`perm_${key}`);
      if (level === "VIEW" || level === "EDIT") permissions[key] = level;
      else delete permissions[key];
    }

    if (id) await db.accessProfile.update({ where: { id }, data: { name, permissions } });
    else await db.accessProfile.create({ data: { name, permissions } });
    return { redirectTo: "/perfis" };
  });
}

const idSchema = z.object({ id: selectId("o perfil") });

export async function deleteAccessProfile(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(idSchema, formData);
  if (parsed.state) return parsed.state;
  return runAction("ADMIN", formData, async () => {
    const users = await db.user.count({ where: { accessProfileId: parsed.data.id } });
    if (users > 0) {
      throw new UserError(`Este perfil está em uso por ${users} usuário(s). Troque o perfil deles antes de excluir.`);
    }
    await db.accessProfile.delete({ where: { id: parsed.data.id } });
    return { redirectTo: "/perfis" };
  });
}
