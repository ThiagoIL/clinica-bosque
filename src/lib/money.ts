const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatMoney = (cents: number | null | undefined) => brl.format((cents ?? 0) / 100);

/** Converte "1.234,56", "1234,56", "1234.56" ou "R$ 10" em centavos. Retorna null se inválido. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).replace(/[^\d.,-]/g, "").trim();
  if (!s || s === "-") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // o último separador é o decimal
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  } else if (lastDot > -1) {
    // "1.234" (milhar) vs "12.5" (decimal)
    const decimals = s.length - lastDot - 1;
    if (decimals === 3 && s.indexOf(".") === lastDot) s = s.replace(".", "");
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** centavos -> "1234,56" (para preencher inputs). */
export const centsToInput = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");

/** Divide um total em n parcelas; o resto vai para a última. */
export function splitCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const result = Array<number>(parts).fill(base);
  result[parts - 1] += total - base * parts;
  return result;
}
