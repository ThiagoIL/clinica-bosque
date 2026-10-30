import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { isDateString, isTimeString } from "@/lib/dates";
import { parseMoney } from "@/lib/money";

z.config(z.locales.pt());

export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** Valores enviados, devolvidos para repreencher o formulário após um erro. */
  values?: Record<string, string>;
};

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

/** Erro de regra de negócio, exibido ao usuário como está. */
export class UserError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

// ── blocos de schema reutilizáveis ──

export const required = (label: string, max = 200) =>
  z
    .string({ error: `${label} é obrigatório` })
    .trim()
    .min(1, `${label} é obrigatório`)
    .max(max, `${label} deve ter no máximo ${max} caracteres`);

export const optional = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => v || null);

export const email = () =>
  z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido");

export const cpf = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? onlyDigits(v) : null))
    .refine((v) => v === null || isValidCpf(v), "CPF inválido");

export const digits = (max = 20) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? onlyDigits(v).slice(0, max) : null));

export const selectId = (label: string) =>
  z.string({ error: `Selecione ${label}` }).trim().min(1, `Selecione ${label}`);

export const optionalId = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null);

export const requiredEnum = <const T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { error: `${label} inválido(a)` });

export const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (values as readonly string[]).includes(v), "Valor inválido")
    .transform((v) => v as T[number] | null);

export const money = (label: string, { allowZero = false }: { allowZero?: boolean } = {}) =>
  z
    .string({ error: `${label} é obrigatório` })
    .transform((v, ctx) => {
      const cents = parseMoney(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label} inválido` });
        return z.NEVER;
      }
      if (cents < 0 || (!allowZero && cents === 0)) {
        ctx.addIssue({ code: "custom", message: `${label} deve ser maior que zero` });
        return z.NEVER;
      }
      return cents;
    });

export const optionalMoney = () =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const cents = parseMoney(v);
      if (cents === null || cents < 0) {
        ctx.addIssue({ code: "custom", message: "Valor inválido" });
        return z.NEVER;
      }
      return cents;
    });

export const integer = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} é obrigatório` })
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      if (v === "" || !Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} deve ser um número inteiro entre ${min} e ${max}` });
        return z.NEVER;
      }
      return n;
    });

export const optionalInteger = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} deve ser um número inteiro entre ${min} e ${max}` });
        return z.NEVER;
      }
      return n;
    });

export const dateField = (label: string) =>
  z
    .string({ error: `${label} é obrigatória` })
    .refine((v) => isDateString(v), `${label} inválida`);

export const optionalDate = (label: string) =>
  z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || isDateString(v), `${label} inválida`);

export const timeField = (label: string) =>
  z.string({ error: `${label} é obrigatório` }).refine((v) => isTimeString(v), `${label} inválido`);

export const checkbox = () =>
  z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true" || v === "1");

// ── parsing ──

export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { data: z.output<S>; state?: undefined } | { data?: undefined; state: FormState } {
  const raw = formValues(formData);
  const result = schema.safeParse(raw);
  if (result.success) return { data: result.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return { state: { error: "Verifique os campos destacados.", fieldErrors, values: raw } };
}
