// Datas da clínica. O Brasil (America/Sao_Paulo) não tem horário de verão desde
// 2019, então o deslocamento fixo de -03:00 é seguro e evita depender do TZ do servidor.
const OFFSET_MS = 3 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Data de calendário "YYYY-MM-DD" -> Date UTC à meia-noite (usado em colunas @db.Date). */
export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date de coluna @db.Date -> "YYYY-MM-DD". */
export function dateOnlyToString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Data/hora local da clínica -> instante (Date). */
export function zoned(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000-03:00`);
}

/** Instante -> { date: "YYYY-MM-DD", time: "HH:mm" } no horário da clínica. */
export function localParts(instant: Date): { date: string; time: string } {
  const shifted = new Date(instant.getTime() - OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

export function todayString(): string {
  return localParts(new Date()).date;
}

export function addDays(date: string, days: number): string {
  const d = dateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Soma meses mantendo o dia (ajustando para o último dia do mês quando necessário). */
export function addMonths(date: string, months: number): string {
  const [y, m, day] = date.split("-").map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(day, lastDay))}`;
}

/** 0 = domingo ... 6 = sábado */
export function weekday(date: string): number {
  return dateOnly(date).getUTCDay();
}

export function startOfWeek(date: string): string {
  return addDays(date, -weekday(date));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string): string {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

export function isDateString(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dateOnly(value).getTime());
}

export function isTimeString(value: string | undefined | null): value is string {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export type RecurrenceKind = "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export const MAX_OCCURRENCES = 400;

const daysBetween = (a: string, b: string) => Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86_400_000);

export type RepeatOptions = {
  /** Quantidade de sessões (termina ao atingir). */
  count?: number;
  /** Data limite, inclusive (termina quando passar dela). */
  until?: string;
  /** Dias da semana (0 = domingo ... 6 = sábado) para repetição diária, semanal e quinzenal. */
  weekdays?: number[];
};

/**
 * Gera as datas das sessões de um lançamento.
 * - Diária: todos os dias (ou só os dias da semana escolhidos).
 * - Semanal / quinzenal: nos dias da semana escolhidos (padrão: o dia da semana da 1ª sessão).
 * - Mensal: no mesmo dia do mês.
 * Termina pela quantidade (`count`) e/ou pela data limite (`until`); no máximo MAX_OCCURRENCES.
 */
export function occurrenceDates(start: string, recurrence: RecurrenceKind, opts: RepeatOptions = {}): string[] {
  const { count, until, weekdays } = opts;
  if (recurrence === "NONE") return !until || start <= until ? [start] : [];
  const limit = Math.min(count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const out: string[] = [];

  if (recurrence === "MONTHLY") {
    for (let i = 0; out.length < limit && i < MAX_OCCURRENCES; i++) {
      const d = addMonths(start, i);
      if (until && d > until) break;
      out.push(d);
    }
    return out;
  }

  const days = new Set(
    weekdays && weekdays.length
      ? weekdays
      : recurrence === "DAILY"
        ? [0, 1, 2, 3, 4, 5, 6]
        : [weekday(start)],
  );
  const firstWeek = startOfWeek(start);
  for (let i = 0; out.length < limit && i < 366 * 5; i++) {
    const d = addDays(start, i);
    if (until && d > until) break;
    if (!days.has(weekday(d))) continue;
    if (recurrence === "BIWEEKLY" && Math.floor(daysBetween(firstWeek, startOfWeek(d)) / 7) % 2 !== 0) continue;
    out.push(d);
  }
  return out;
}

// ── formatação (pt-BR) ──

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const s = typeof value === "string" ? value.slice(0, 10) : dateOnlyToString(value);
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(instant: Date): string {
  const { date, time } = localParts(instant);
  return `${formatDate(date)} ${time}`;
}

export function formatTime(instant: Date): string {
  return localParts(instant).time;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export const monthName = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1];
export const weekdayName = (date: string) => WEEKDAYS[weekday(date)];
export const weekdayShort = (date: string) => WEEKDAYS[weekday(date)].slice(0, 3);
export const monthTitle = (date: string) => `${monthName(date)} de ${date.slice(0, 4)}`;

export function ageFromBirth(birth: Date | null | undefined): number | null {
  if (!birth) return null;
  const today = todayString();
  const b = dateOnlyToString(birth);
  let age = Number(today.slice(0, 4)) - Number(b.slice(0, 4));
  if (today.slice(5) < b.slice(5)) age--;
  return age;
}
