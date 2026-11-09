const SMALL_WORDS = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * Tudo em minúsculas e a primeira letra de cada palavra em maiúscula; "da, de, do, das, dos, e" ficam em minúsculas.
 * "ALEXANDRE WAGNER DA SILVA" e "alexandre wagner da silva" → "Alexandre Wagner da Silva".
 */
export function titleCaseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}
