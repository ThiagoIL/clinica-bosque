import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { UserError, formValues, type FormState } from "@/lib/form";

type Outcome = FormState | { redirectTo: string } | void;

/** Executa uma ação do console do fornecedor (exige sessão de fornecedor; erros de negócio viram mensagem). */
export async function runPlatformAction(
  formData: FormData,
  fn: (admin: Awaited<ReturnType<typeof requirePlatformAdmin>>) => Promise<Outcome>,
): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const values = formValues(formData);
  let outcome: Outcome;
  try {
    outcome = await fn(admin);
  } catch (error) {
    if (error instanceof UserError) return { error: error.message, fieldErrors: error.fieldErrors, values };
    console.error("[platform-action]", error);
    return { error: "Ocorreu um erro inesperado. Tente novamente.", values };
  }
  revalidatePath("/platform", "layout");
  if (outcome && "redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome ?? { success: "Salvo com sucesso." };
}

/** Registra um evento no histórico do console (bloqueios, módulos, senha). */
export async function logPlatformEvent(type: string, message: string, adminEmail: string | null) {
  await db.platformEvent.create({ data: { type, message, adminEmail } });
}
