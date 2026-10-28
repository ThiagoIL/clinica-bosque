// Ficha de anamnese do paciente. Os campos ficam em um JSON no paciente (Patient.anamnesis);
// os marcados com `column` já existiam como colunas do cadastro de saúde e continuam lá.

export type AnField =
  | { key: string; label: string; type: "text" | "textarea"; column?: boolean }
  | { key: string; label: string; type: "select"; options: string[]; column?: boolean }
  | { key: string; label: string; type: "checks"; options: string[] }
  /** Seletor + texto livre ("Consciência da doença atual"); grava `key` e `${key}Text`. */
  | { key: string; label: string; type: "awareness"; options: string[] };

export type AnSection = { id: string; title: string; fields: AnField[] };

export const ANAMNESIS_SECTIONS: AnSection[] = [
  {
    id: "saude",
    title: "Dados de saúde",
    fields: [
      { key: "bloodType", label: "Tipo sanguíneo", type: "select", column: true, options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
      { key: "allergies", label: "Alergias", type: "textarea", column: true },
      { key: "chronicConditions", label: "Condições crônicas", type: "textarea", column: true },
      { key: "surgeries", label: "Cirurgias anteriores", type: "textarea", column: true },
      { key: "diagnosis", label: "Diagnóstico", type: "textarea", column: true },
      { key: "healthNotes", label: "Outras informações de saúde", type: "textarea", column: true },
    ],
  },
  {
    id: "atendimento",
    title: "Atendimento",
    fields: [
      { key: "complaint", label: "Queixa ou motivo da consulta", type: "textarea" },
      { key: "demand", label: "Avaliação de demanda", type: "textarea" },
    ],
  },
  {
    id: "doenca",
    title: "Histórico da doença atual",
    fields: [
      { key: "onset", label: "Início da patologia", type: "textarea" },
      { key: "frequency", label: "Frequência", type: "textarea" },
      { key: "intensity", label: "Intensidade", type: "text" },
      { key: "previousTreatments", label: "Tratamentos anteriores", type: "textarea" },
      { key: "medications", label: "Medicamentos", type: "textarea", column: true },
    ],
  },
  {
    id: "pessoal",
    title: "Histórico pessoal",
    fields: [
      { key: "childhood", label: "Infância", type: "textarea" },
      { key: "routine", label: "Rotina", type: "textarea" },
      { key: "vices", label: "Vícios", type: "textarea" },
      { key: "hobbies", label: "Hobbies", type: "textarea" },
      { key: "work", label: "Trabalho", type: "textarea" },
    ],
  },
  {
    id: "familiar",
    title: "Histórico familiar",
    fields: [
      { key: "parents", label: "Pais", type: "textarea" },
      { key: "siblings", label: "Irmãos", type: "textarea" },
      { key: "spouse", label: "Cônjuge", type: "textarea" },
      { key: "children", label: "Filhos", type: "textarea" },
      { key: "home", label: "Lar", type: "textarea" },
      { key: "pastHistory", label: "História patológica pregressa (enfermidades e tratamentos atuais e anteriores)", type: "textarea" },
    ],
  },
  {
    id: "psiquico",
    title: "Exame psíquico",
    fields: [
      { key: "appearance", label: "Aparência", type: "textarea" },
      { key: "behavior", label: "Comportamento", type: "textarea" },
      { key: "attitude", label: "Atitude para com o entrevistador", type: "checks", options: ["Cooperativo", "Resistente", "Indiferente"] },
      {
        key: "orientation", label: "Orientação", type: "checks",
        options: ["Auto-identificatória", "Corporal", "Temporal", "Espacial", "Orientado em relação à patologia"],
      },
      { key: "psychicObservation", label: "Observação", type: "textarea" },
      { key: "memory", label: "Memória", type: "textarea" },
      { key: "intelligence", label: "Inteligência", type: "textarea" },
      { key: "perception", label: "Sensopercepção (normal ou alucinação)", type: "text" },
      { key: "thinking", label: "Pensamento", type: "checks", options: ["Acelerado", "Retardado", "Fuga", "Bloqueio", "Prolixo", "Repetição"] },
      {
        key: "language", label: "Linguagem", type: "checks",
        options: [
          "Disartria (má articulação)",
          "Afasias, verbigeração (repetição de palavras)",
          "Parafasia (emprego inapropriado de palavras com sentidos parecidos)",
          "Neologismo",
          "Mussitação (voz murmurada em tom baixo)",
          "Logorreia (fluxo incessante e incoercível de palavras)",
          "Para-respostas (responde a uma indagação com algo que não tem nada a ver com o que foi perguntado)",
        ],
      },
      { key: "affectivity", label: "Afetividade", type: "textarea" },
      {
        key: "mood", label: "Humor", type: "checks",
        options: ["Normal", "Exaltado", "Baixa de humor", "Quebra súbita da tonalidade do humor durante a entrevista"],
      },
      { key: "awareness", label: "Consciência da doença atual", type: "awareness", options: ["Presente", "Parcial", "Ausente"] },
      { key: "hypothesis", label: "Hipótese diagnóstica", type: "textarea" },
    ],
  },
];

export const ANAMNESIS_PREFIX = "an_";

export type AnamnesisData = Record<string, string | string[]>;

/** Lê o JSON gravado no paciente de forma segura (qualquer coisa fora do esperado vira vazio). */
export function parseAnamnesis(value: unknown): AnamnesisData {
  const out: AnamnesisData = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[key] = v;
    else if (Array.isArray(v)) out[key] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

const TEXT_MAX = 200;
const TEXTAREA_MAX = 4000;

/**
 * Separa o formulário enviado em: JSON da anamnese e colunas do cadastro de saúde.
 * Só aceita os campos e as opções definidos acima.
 */
export function readAnamnesisForm(formData: FormData): { json: AnamnesisData; columns: Record<string, string | null> } {
  const json: AnamnesisData = {};
  const columns: Record<string, string | null> = {};
  const get = (name: string) => {
    const v = formData.get(ANAMNESIS_PREFIX + name);
    return typeof v === "string" ? v.trim() : "";
  };
  const put = (field: { key: string; column?: boolean }, value: string) => {
    if (field.column) columns[field.key] = value || null;
    else if (value) json[field.key] = value;
  };

  for (const section of ANAMNESIS_SECTIONS) {
    for (const field of section.fields) {
      if (field.type === "text") put(field, get(field.key).slice(0, TEXT_MAX));
      else if (field.type === "textarea") put(field, get(field.key).slice(0, TEXTAREA_MAX));
      else if (field.type === "select") {
        const v = get(field.key);
        put(field, field.options.includes(v) ? v : "");
      } else if (field.type === "checks") {
        const picked = formData
          .getAll(ANAMNESIS_PREFIX + field.key)
          .filter((v): v is string => typeof v === "string" && field.options.includes(v));
        if (picked.length) json[field.key] = picked;
      } else if (field.type === "awareness") {
        const v = get(field.key);
        if (field.options.includes(v)) json[field.key] = v;
        const text = get(`${field.key}Text`).slice(0, TEXT_MAX);
        if (text) json[`${field.key}Text`] = text;
      }
    }
  }
  const observations = get("observations").slice(0, TEXTAREA_MAX);
  if (observations) json.observations = observations;
  return { json, columns };
}
