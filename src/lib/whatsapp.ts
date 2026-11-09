import { onlyDigits } from "@/lib/cpf";
import { titleCaseName } from "@/lib/names";

/**
 * Número no formato do WhatsApp (só dígitos, com o código do país). Telefones brasileiros cadastrados
 * com DDD (10 ou 11 dígitos) ganham o 55; números que já vêm com o código ficam como estão.
 * Devolve null quando não parece um telefone válido.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  let digits = onlyDigits(phone ?? "");
  digits = digits.replace(/^0+/, ""); // zero de discagem à esquerda
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : null;
}

// nomes digitados em caixa alta ficam legíveis na mensagem
export { titleCaseName };

// ── modelos de mensagem ──

export const CLINIC_NAME = "Clínica Bosque";

/** Variáveis que os modelos podem usar, escritas entre chaves: {primeiro_nome}. `sample` alimenta a prévia. */
export const TEMPLATE_VARIABLES = [
  { key: "primeiro_nome", label: "Primeiro nome do paciente", sample: "Ana" },
  { key: "paciente", label: "Nome completo do paciente", sample: "Ana Beatriz Lima" },
  { key: "data", label: "Data da consulta", sample: "04/11/2026" },
  { key: "dia_semana", label: "Dia da semana", sample: "quarta-feira" },
  { key: "horario", label: "Horário de início", sample: "15:00" },
  { key: "profissional", label: "Nome do profissional", sample: "Dra. Helena Duarte" },
  { key: "servico", label: "Serviço / tipo de atendimento", sample: "Consulta médica" },
  { key: "clinica", label: "Nome da clínica", sample: CLINIC_NAME },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]["key"];
export type MessageVars = Record<TemplateVariable, string>;

/** Valores de exemplo, para a prévia na tela de edição do modelo. */
export const SAMPLE_VARS = Object.fromEntries(TEMPLATE_VARIABLES.map((v) => [v.key, v.sample])) as MessageVars;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));

/** Troca {variavel} pelo valor; o que não for uma variável conhecida fica como foi escrito. */
export function renderTemplate(body: string, vars: MessageVars): string {
  return body.replace(/\{(\w+)\}/g, (whole, key: string) => (KNOWN.has(key) ? vars[key as TemplateVariable] : whole));
}

/** Variáveis escritas no texto que não existem (provável erro de digitação), sem repetição. */
export function unknownVariables(body: string): string[] {
  const found = new Set<string>();
  for (const [, key] of body.matchAll(/\{([^{}\n]*)\}/g)) if (!KNOWN.has(key)) found.add(key);
  return [...found];
}

/** Modelo usado quando a clínica ainda não cadastrou nenhum (igual ao "Lembrete de consulta" que já vem pronto). */
export const DEFAULT_TEMPLATE_BODY = [
  "Olá, {primeiro_nome}! Aqui é da {clinica}.",
  "",
  "Passando para lembrar da sua consulta:",
  "📅 Data: {dia_semana}, {data}",
  "🕒 Horário: {horario}",
  "🩺 Atendimento: {servico}",
  "👨‍⚕️ Profissional: {profissional}",
  "",
  "Por favor, confirme sua presença respondendo esta mensagem. Se não puder comparecer, avise com antecedência para reagendarmos.",
].join("\n");

export type AppointmentMessage = {
  patientName: string;
  professionalName: string;
  serviceName: string;
  /** Dia da semana por extenso, ex.: "terça-feira". */
  weekday: string;
  /** Data formatada, ex.: "03/11/2026". */
  date: string;
  /** Horário de início, ex.: "15:00". */
  time: string;
};

/** Valores das variáveis para um atendimento. */
export function appointmentVars(a: AppointmentMessage): MessageVars {
  return {
    primeiro_nome: titleCaseName(a.patientName).split(" ")[0],
    paciente: titleCaseName(a.patientName),
    data: a.date,
    dia_semana: a.weekday,
    horario: a.time,
    profissional: titleCaseName(a.professionalName),
    servico: a.serviceName,
    clinica: CLINIC_NAME,
  };
}

/**
 * Link da conversa com o texto já preenchido.
 *  - computador: WhatsApp Web (precisa estar conectado);
 *  - celular (`app`): abre direto o aplicativo do WhatsApp, inclusive com o sistema instalado na tela inicial.
 */
export function whatsappLink(number: string, text: string, app = false): string {
  const query = `phone=${number}&text=${encodeURIComponent(text)}`;
  return app ? `whatsapp://send?${query}` : `https://web.whatsapp.com/send?${query}&app_absent=0`;
}

/** O aparelho é um celular/tablet (inclui iPad que se apresenta como Mac). Só no navegador. */
export function isTouchPhone(): boolean {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
