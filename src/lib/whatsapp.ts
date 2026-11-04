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
