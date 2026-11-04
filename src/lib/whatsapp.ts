import { onlyDigits } from "@/lib/cpf";

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

const SMALL_WORDS = new Set(["da", "de", "do", "das", "dos", "e"]);

/** "ALEXANDRE WAGNER DA SILVA" → "Alexandre Wagner da Silva" (nomes digitados em caixa alta ficam legíveis na mensagem). */
export function titleCaseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

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

/** Texto da mensagem de lembrete/confirmação da consulta. */
export function appointmentMessage(a: AppointmentMessage): string {
  const first = titleCaseName(a.patientName).split(" ")[0];
  return [
    `Olá, ${first}! Aqui é da Clínica Bosque.`,
    "",
    "Passando para lembrar da sua consulta:",
    `📅 Data: ${a.weekday}, ${a.date}`,
    `🕒 Horário: ${a.time}`,
    `🩺 Atendimento: ${a.serviceName}`,
    `👨‍⚕️ Profissional: ${titleCaseName(a.professionalName)}`,
    "",
    "Por favor, confirme sua presença respondendo esta mensagem. Se não puder comparecer, avise com antecedência para reagendarmos.",
  ].join("\n");
}

/** Link que abre a conversa no WhatsApp Web (o computador precisa estar com o WhatsApp conectado) já com o texto preenchido. */
export function whatsappLink(number: string, text: string): string {
  return `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}&app_absent=0`;
}
