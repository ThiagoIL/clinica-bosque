"use server";

import { db } from "@/lib/db";
import { runAction } from "@/lib/action";
import { dateOnly } from "@/lib/dates";
import { UserError, type FormState } from "@/lib/form";
import { SheetError, normalizeRow, readPatientSheet, type PatientImportData } from "@/lib/patient-import";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_LINES = 200;

/**
 * Importa pacientes de uma planilha do Excel (.xlsx). Com `mode=check` só confere e mostra o resultado;
 * com `mode=import` cadastra as linhas válidas. Linhas com problema ou repetidas são ignoradas e listadas.
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
    const keyOf = (name: string, birth: string | null) => `${name.toLowerCase()}|${birth ?? ""}`;
    const seenCpf = new Set(existing.map((p) => p.cpf).filter((c): c is string => !!c));
    const seenName = new Set(existing.map((p) => keyOf(p.name, p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null)));

    const ready: (PatientImportData & { healthPlanId: string | null; line: number })[] = [];
    const problems: string[] = [];
    let duplicates = 0;

    for (const { line, raw } of rows) {
      const result = normalizeRow(raw);
      if ("errors" in result) {
        problems.push(`Linha ${line}${raw.name ? ` (${raw.name})` : ""}: ${result.errors.join("; ")}`);
        continue;
      }
      const { data, plan } = result;
      let healthPlanId = particular;
      if (plan) {
        const found = planByName.get(plan.toLowerCase());
        if (!found) {
          problems.push(`Linha ${line} (${data.name}): plano de saúde “${plan}” não encontrado em Planos de saúde`);
          continue;
        }
        healthPlanId = found;
      }
      const nameKey = keyOf(data.name, data.birthDate);
      if ((data.cpf && seenCpf.has(data.cpf)) || (!data.cpf && seenName.has(nameKey))) {
        duplicates++;
        problems.push(`Linha ${line} (${data.name}): já cadastrado${data.cpf ? " (mesmo CPF)" : " (mesmo nome e nascimento)"}; ignorado`);
        continue;
      }
      if (data.cpf) seenCpf.add(data.cpf);
      seenName.add(nameKey);
      ready.push({ ...data, healthPlanId, line });
    }

    if (importing && ready.length > 0) {
      await db.patient.createMany({
        data: ready.map(({ line: _line, birthDate, ...p }) => ({ ...p, birthDate: birthDate ? dateOnly(birthDate) : null })),
      });
    }

    const invalid = problems.length - duplicates;
    const counts =
      `${ready.length} paciente(s) ${importing ? "cadastrado(s)" : "prontos para cadastrar"}` +
      (duplicates ? `, ${duplicates} já existente(s) ignorado(s)` : "") +
      (invalid ? `, ${invalid} linha(s) com problema` : "") + ".";

    const details: string[] = [];
    if (!importing && ready.length > 0) {
      details.push(`Como ficarão os nomes: ${ready.slice(0, 5).map((p) => p.name).join(" · ")}${ready.length > 5 ? " …" : ""}`);
    }
    details.push(...problems.slice(0, MAX_LINES));
    if (problems.length > MAX_LINES) details.push(`… e mais ${problems.length - MAX_LINES} linha(s) com problema.`);

    return {
      success: importing
        ? `Importação concluída: ${counts}${invalid ? " Corrija as linhas com problema na planilha e envie de novo (as já cadastradas serão ignoradas)." : ""}`
        : `Conferência: ${counts} Nada foi gravado ainda.`,
      details,
    };
  });
}
