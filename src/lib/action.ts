import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { hasAccess, loadSnapshot } from "@/lib/access";
import type { Access } from "@/lib/modules";
import { UserError, formValues, type FormState } from "@/lib/form";

type Outcome = FormState | { redirectTo: string } | void;

const UNIQUE_LABELS: Record<string, string> = {
  cpf: "CPF",
  email: "e-mail",
  name: "nome",
  sku: "código (SKU)",
};

function friendlyDatabaseError(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const e = error as { code?: string; meta?: { target?: string[] | string; driverAdapterError?: unknown }; message?: string };
  const message = String(e.message ?? "");

  if (message.includes("Appointment_no_professional_overlap")) {
    return "O profissional já possui um atendimento neste horário.";
  }
  if (message.includes("Appointment_no_patient_overlap")) {
    return "O paciente já possui um atendimento neste horário.";
  }
  if (e.code === "P2002") {
    const target = Array.isArray(e.meta?.target) ? e.meta.target : [String(e.meta?.target ?? "")];
    const label = target.map((t) => UNIQUE_LABELS[t]).find(Boolean);
    return label ? `Já existe um registro com este ${label}.` : "Já existe um registro com estes dados.";
  }
  if (e.code === "P2003") return "Este registro está em uso e não pode ser removido.";
  return null;
}

/**
 * Executa uma server action com autenticação, tratamento de erros de negócio
 * e redirecionamento opcional (feito fora do try/catch, pois redirect() lança).
 */
export async function runAction(
  access: Access | Access[] | null,
  formData: FormData,
  fn: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<Outcome>,
): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData);
  let outcome: Outcome;
  try {
    if (access) {
      // qualquer um dos módulos informados com nível "Edita" (ou administrador, quando "ADMIN")
      const snapshot = await loadSnapshot(user.id);
      const needed = Array.isArray(access) ? access : [access];
      if (!needed.some((a) => hasAccess(snapshot, a, "EDIT"))) {
        throw new UserError(
          needed.includes("ADMIN") && needed.length === 1
            ? "Somente o administrador da empresa pode fazer isto."
            : "Seu perfil de acesso não permite alterar este módulo.",
        );
      }
    }
    outcome = await fn(user);
  } catch (error) {
    if (error instanceof UserError) return { error: error.message, fieldErrors: error.fieldErrors, values };
    const friendly = friendlyDatabaseError(error);
    if (friendly) return { error: friendly, values };
    console.error("[action]", error);
    return { error: "Ocorreu um erro inesperado. Tente novamente.", values };
  }

  revalidatePath("/", "layout");
  if (outcome && "redirectTo" in outcome) redirect(outcome.redirectTo);
  return outcome ?? { success: "Salvo com sucesso." };
}
