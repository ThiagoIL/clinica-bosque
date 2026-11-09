"use server";

import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { dateOnly } from "@/lib/dates";
import { UserError, type FormState } from "@/lib/form";
import { SheetError, normalizeRow, readPatientSheet, type PatientImportData } from "@/lib/patient-import";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** Quantas linhas de cada tipo aparecem na lista de detalhes (o total vai sempre na mensagem). */
const SHOW_ERRORS = 100;
const SHOW_WARNINGS = 40;
const SHOW_DUPLICATES = 10;
/** Gravação em lotes (o PostgreSQL limita os parâmetros de uma única consulta). */
const BATCH = 300;

const fmt = (n: number) => n.toLocaleString("pt-BR");

/**
 * Importa pacientes de uma planilha do Excel (.xlsx). Com `mode=check` só confere e mostra o resultado;
 * com `mode=import` cadastra. Só o nome é indispensável: campos opcionais inválidos são ignorados (com aviso).
 * Linhas sem nome, com plano inexistente ou repetidas não são importadas e ficam listadas.
 */
export async function importPatients(_: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get("file");
  const importing = formData.get("mode") === "import";

  return runAction("PACIENTES", formData, async () => {
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecione a planilha do Excel (.xlsx).");
    if (file.size > MAX_FILE_BYTES) throw new UserError("A planilha é grande demais (máximo de 8 MB).");

    let rows;
    try {
      rows = await readPatientSheet(Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      if (error instanceof SheetError) throw new UserError(error.message);
      throw error;
    }
    if (rows.length === 0) throw new UserError("A planilha não tem pacientes (as linhas abaixo dos títulos estão vazias).");

    // pacientes já cadastrados: por CPF, ou por nome + data de nascimento quando não há CPF
    const [plans, existing] = await Promise.all([
      db.healthPlan.findMany({ select: { id: true, name: true, isDefault: true } }),
      db.patient.findMany({ select: { cpf: true, name: true, birthDate: true } }),
    ]);
    const particular = plans.find((p) => p.isDefault)?.id ?? null;
    const planByName = new Map(plans.map((p) => [p.name.toLowerCase(), p.id]));
    const keyOf = (name: string, birth: string | null) => `${name.toLowerCase().replace(/\s+/g, " ")}|${birth ?? ""}`;
    const seenCpf = new Set(existing.map((p) => p.cpf).filter((c): c is string => !!c));
    const seenName = new Set(existing.map((p) => keyOf(p.name, p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null)));

    type Ready = PatientImportData & { healthPlanId: string | null };
    const ready: Ready[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const duplicates: string[] = [];
    let withWarnings = 0;

    for (const { line, raw } of rows) {
      const result = normalizeRow(raw);
      if ("errors" in result) {
        errors.push(`Linha ${line}${raw.name ? ` (${raw.name})` : ""}: ${result.errors.join("; ")}`);
        continue;
      }
      const { data, plan, warnings: rowWarnings } = result;

      let healthPlanId = particular;
      if (plan) {
        const found = planByName.get(plan.toLowerCase());
        if (!found) {
          errors.push(`Linha ${line} (${data.name}): plano de saúde “${plan}” não encontrado em Planos de saúde`);
          continue;
        }
        healthPlanId = found;
      }

      const nameKey = keyOf(data.name, data.birthDate);
      if (data.cpf ? seenCpf.has(data.cpf) : seenName.has(nameKey)) {
        duplicates.push(`Linha ${line} (${data.name}): ${data.cpf ? "CPF repetido" : "mesmo nome e nascimento"}`);
        continue;
      }
      if (data.cpf) seenCpf.add(data.cpf);
      seenName.add(nameKey);

      if (rowWarnings.length > 0) {
        withWarnings++;
        warnings.push(`Linha ${line} (${data.name}): ${rowWarnings.join("; ")}`);
      }
      ready.push({ ...data, healthPlanId });
    }

    if (importing && ready.length > 0) {
      const toDb = ({ birthDate, createdAt, ...p }: Ready) => ({
        ...p,
        birthDate: birthDate ? dateOnly(birthDate) : null,
        ...(createdAt ? { createdAt: dateOnly(createdAt) } : {}),
      });
      await db.$transaction(
        async (tx) => {
          for (let i = 0; i < ready.length; i += BATCH) {
            await tx.patient.createMany({ data: ready.slice(i, i + BATCH).map(toDb) });
          }
        },
        { timeout: 120_000, maxWait: 20_000 },
      );
    }

    const parts = [
      `${fmt(ready.length)} paciente(s) ${importing ? "cadastrado(s)" : "prontos para cadastrar"}`,
      duplicates.length ? `${fmt(duplicates.length)} repetido(s)/já existente(s) ignorado(s)` : "",
      errors.length ? `${fmt(errors.length)} linha(s) com problema (não importadas)` : "",
      withWarnings ? `${fmt(withWarnings)} com campo inválido ignorado` : "",
    ].filter(Boolean);
    const summary = `${parts.join(", ")}.`;

    const details: string[] = [];
    if (!importing && ready.length > 0) {
      details.push(`Como ficarão os nomes: ${ready.slice(0, 5).map((p) => p.name).join(" · ")}${ready.length > 5 ? " …" : ""}`);
    }
    const section = (title: string, lines: string[], limit: number) => {
      if (lines.length === 0) return;
      details.push(`${title} (${fmt(lines.length)}):`);
      details.push(...lines.slice(0, limit));
      if (lines.length > limit) details.push(`… e mais ${fmt(lines.length - limit)}.`);
    };
    section("Linhas não importadas por problema", errors, SHOW_ERRORS);
    section("Avisos: campo inválido ignorado, paciente importado", warnings, SHOW_WARNINGS);
    section("Repetidos ou já cadastrados", duplicates, SHOW_DUPLICATES);

    return {
      success: importing
        ? `Importação concluída: ${summary}${errors.length ? " Corrija as linhas com problema e envie a planilha de novo (as já cadastradas são ignoradas)." : ""}`
        : `Conferência: ${summary} Nada foi gravado ainda.`,
      details,
    };
  });
}
