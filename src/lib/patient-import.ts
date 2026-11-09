import ExcelJS from "exceljs";
import { z } from "zod";
import { isDateString } from "@/lib/dates";
import { onlyDigits } from "@/lib/cpf";
import { titleCaseName } from "@/lib/names";
import { cpf, digits, email, optional, optionalEnum, required } from "@/lib/form";

/** Máximo de linhas por planilha (evita travar o servidor com um arquivo gigante). */
export const MAX_IMPORT_ROWS = 2000;

type FieldKey =
  | "name" | "socialName" | "cpf" | "rg" | "birthDate" | "sex" | "phone" | "phone2" | "email"
  | "zipCode" | "street" | "number" | "complement" | "neighborhood" | "city" | "state"
  | "plan" | "guardianName" | "guardianPhone" | "observations";

/** Colunas da planilha: título (como no modelo), nome interno e outros títulos aceitos (sem acento/maiúscula). */
export const IMPORT_COLUMNS: { key: FieldKey; title: string; width: number; help: string; aliases: string[] }[] = [
  { key: "name", title: "Nome", width: 34, help: "Obrigatório. Vira minúsculas com a 1ª letra de cada nome em maiúscula.", aliases: ["nomecompleto", "paciente", "nomedopaciente"] },
  { key: "socialName", title: "Nome social", width: 24, help: "Opcional.", aliases: [] },
  { key: "cpf", title: "CPF", width: 16, help: "Opcional. Com ou sem pontos. CPF repetido não é importado de novo.", aliases: [] },
  { key: "rg", title: "RG", width: 14, help: "Opcional.", aliases: [] },
  { key: "birthDate", title: "Data de nascimento", width: 20, help: "Opcional. Formato dd/mm/aaaa (ou uma célula de data do Excel).", aliases: ["nascimento", "datanascimento", "dtnascimento"] },
  { key: "sex", title: "Sexo", width: 12, help: "Opcional. F / Feminino, M / Masculino ou Outro.", aliases: ["genero"] },
  { key: "phone", title: "Telefone", width: 18, help: "Opcional. Com DDD; é o número usado no WhatsApp.", aliases: ["celular", "telefone1", "whatsapp", "fone"] },
  { key: "phone2", title: "Telefone 2", width: 18, help: "Opcional.", aliases: ["celular2", "fone2"] },
  { key: "email", title: "E-mail", width: 28, help: "Opcional.", aliases: ["email"] },
  { key: "zipCode", title: "CEP", width: 12, help: "Opcional.", aliases: [] },
  { key: "street", title: "Rua", width: 30, help: "Opcional.", aliases: ["endereco", "logradouro"] },
  { key: "number", title: "Número", width: 10, help: "Opcional.", aliases: ["num"] },
  { key: "complement", title: "Complemento", width: 16, help: "Opcional.", aliases: [] },
  { key: "neighborhood", title: "Bairro", width: 20, help: "Opcional.", aliases: [] },
  { key: "city", title: "Cidade", width: 20, help: "Opcional.", aliases: ["municipio"] },
  { key: "state", title: "UF", width: 6, help: "Opcional. Duas letras (SP, RJ…).", aliases: ["estado"] },
  { key: "plan", title: "Plano de saúde", width: 20, help: "Opcional. Igual ao cadastrado em Planos de saúde; em branco = Particular.", aliases: ["plano", "convenio"] },
  { key: "guardianName", title: "Responsável", width: 26, help: "Opcional. Nome do responsável.", aliases: ["nomedoresponsavel"] },
  { key: "guardianPhone", title: "Telefone do responsável", width: 22, help: "Opcional.", aliases: ["telefoneresponsavel", "foneresponsavel"] },
  { key: "observations", title: "Observações", width: 30, help: "Opcional.", aliases: ["observacao", "obs"] },
];

const simplify = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADER_LOOKUP = new Map<string, FieldKey>(
  IMPORT_COLUMNS.flatMap((c) => [c.title, ...c.aliases].map((t) => [simplify(t), c.key] as const)),
);

/** Texto de uma célula, qualquer que seja o tipo (texto, número, data, fórmula, link, texto formatado). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return cellText(value.text as ExcelJS.CellValue); // link (e-mail com hiperlink)
    if ("error" in value) return "";
  }
  return String(value).trim();
}

export type ImportRow = { line: number; raw: Record<FieldKey, string> };

/** Lê a primeira aba da planilha: acha a linha de títulos e devolve as linhas preenchidas. */
export async function readPatientSheet(file: Buffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new SheetError("Não consegui abrir o arquivo. Envie uma planilha do Excel no formato .xlsx.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new SheetError("A planilha está vazia.");

  // linha de títulos: a primeira (entre as 10 primeiras) que tem a coluna "Nome"
  let headerRow = 0;
  const columns = new Map<number, FieldKey>();
  for (let r = 1; r <= Math.min(10, sheet.rowCount) && !headerRow; r++) {
    const found = new Map<number, FieldKey>();
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const key = HEADER_LOOKUP.get(simplify(cellText(cell.value)));
      if (key && ![...found.values()].includes(key)) found.set(col, key);
    });
    if ([...found.values()].includes("name")) {
      headerRow = r;
      found.forEach((key, col) => columns.set(col, key));
    }
  }
  if (!headerRow) throw new SheetError("Não encontrei a coluna “Nome” nas primeiras linhas. Use o modelo de planilha para conferir os títulos.");

  const rows: ImportRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const raw = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, ""])) as Record<FieldKey, string>;
    let filled = false;
    columns.forEach((key, col) => {
      const text = cellText(sheet.getRow(r).getCell(col).value);
      if (text) filled = true;
      raw[key] = text;
    });
    if (filled) rows.push({ line: r, raw });
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new SheetError(`A planilha tem mais de ${MAX_IMPORT_ROWS} pacientes. Divida em arquivos menores.`);
    }
  }
  return rows;
}

export class SheetError extends Error {}

/** Planilha modelo: títulos na primeira linha e uma aba com as instruções. */
export async function buildPatientTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pacientes", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = IMPORT_COLUMNS.map((c) => ({ header: c.title, key: c.key, width: c.width }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF667B35" } };
  // CPF, telefones, CEP e RG como texto, para o Excel não cortar zeros à esquerda
  for (const key of ["cpf", "rg", "phone", "phone2", "zipCode", "guardianPhone", "number"] as const) {
    sheet.getColumn(key).numFmt = "@";
  }

  const help = workbook.addWorksheet("Instruções", { properties: { tabColor: { argb: "FF667B35" } } });
  help.columns = [{ header: "Coluna", key: "c", width: 26 }, { header: "Como preencher", key: "h", width: 90 }];
  help.getRow(1).font = { bold: true };
  for (const c of IMPORT_COLUMNS) help.addRow({ c: c.title, h: c.help });
  help.addRow({});
  help.addRow({ c: "Importante", h: "Preencha a aba “Pacientes” a partir da linha 2 (a linha 1 são os títulos). Pacientes com CPF já cadastrado, ou com o mesmo nome e data de nascimento, são ignorados." });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ───────────────────────── validação de cada linha ─────────────────────────

const SEX_MAP: Record<string, "FEMALE" | "MALE" | "OTHER"> = {
  f: "FEMALE", fem: "FEMALE", feminino: "FEMALE", mulher: "FEMALE",
  m: "MALE", masc: "MALE", masculino: "MALE", homem: "MALE",
  o: "OTHER", outro: "OTHER", outra: "OTHER", outros: "OTHER",
};

/** dd/mm/aaaa, aaaa-mm-dd ou dd/mm/aa → aaaa-mm-dd (ou "" se não der para entender). */
function parseBirthDate(text: string): string {
  const t = text.trim();
  if (!t) return "";
  let year: number, month: number, day: number;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (br) {
    [day, month] = [Number(br[1]), Number(br[2])];
    year = br[3].length === 2 ? (Number(br[3]) > new Date().getFullYear() % 100 ? 1900 : 2000) + Number(br[3]) : Number(br[3]);
  } else return "invalid";
  // o calendário precisa existir (31/02 não) e o ano ser plausível
  const check = new Date(Date.UTC(year, month - 1, day));
  const exists = check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  if (!exists || year < 1900 || check.getTime() > Date.now()) return "invalid";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Telefone só com dígitos, sem o 55 do país (o cadastro guarda DDD + número). */
function localPhone(text: string): string {
  let d = onlyDigits(text);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d;
}

/** Remove o que a planilha costuma bagunçar: zeros à esquerda de CPF/CEP que viraram número. */
function padDigits(text: string, size: number, min: number): string {
  const d = onlyDigits(text);
  return d.length >= min && d.length < size ? d.padStart(size, "0") : text;
}

const schema = z.object({
  name: required("Nome", 150),
  socialName: optional(150),
  cpf: cpf(),
  rg: optional(30),
  birthDate: z.string().transform((v) => v || null).refine((v) => v === null || isDateString(v), "Data de nascimento inválida"),
  sex: optionalEnum(["FEMALE", "MALE", "OTHER"] as const),
  phone: digits(11),
  phone2: digits(11),
  email: email(),
  zipCode: digits(8),
  street: optional(150),
  number: optional(20),
  complement: optional(100),
  neighborhood: optional(100),
  city: optional(100),
  state: optional(2),
  guardianName: optional(150),
  guardianPhone: digits(11),
  observations: optional(5000),
});

export type PatientImportData = Omit<z.output<typeof schema>, "birthDate"> & { birthDate: string | null };

const LABELS: Record<string, string> = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.title]));

/** Limpa e valida uma linha. Devolve os dados prontos para gravar ou a lista de problemas. */
export function normalizeRow(raw: Record<FieldKey, string>): { data: PatientImportData; plan: string } | { errors: string[] } {
  const birth = parseBirthDate(raw.birthDate);
  const sexKey = simplify(raw.sex);
  const input: Record<string, string> = {
    name: titleCaseName(raw.name),
    socialName: titleCaseName(raw.socialName),
    cpf: padDigits(raw.cpf, 11, 9),
    rg: raw.rg,
    birthDate: birth === "invalid" ? "x" : birth,
    sex: sexKey ? (SEX_MAP[sexKey] ?? "?") : "",
    phone: localPhone(raw.phone),
    phone2: localPhone(raw.phone2),
    email: raw.email.replace(/^mailto:/i, "").trim().toLowerCase(),
    zipCode: padDigits(raw.zipCode, 8, 5),
    street: titleCaseName(raw.street),
    number: raw.number,
    complement: raw.complement,
    neighborhood: titleCaseName(raw.neighborhood),
    city: titleCaseName(raw.city),
    state: raw.state.trim().toUpperCase(),
    guardianName: titleCaseName(raw.guardianName),
    guardianPhone: localPhone(raw.guardianPhone),
    observations: raw.observations,
  };

  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = new Set<string>();
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key === "sex") errors.add("Sexo inválido (use F, M ou Outro)");
      else if (key === "name") errors.add(issue.message);
      else errors.add(/inválid/.test(issue.message) ? issue.message : `${LABELS[key] ?? key}: ${issue.message}`);
    }
    return { errors: [...errors] };
  }
  return { data: result.data as PatientImportData, plan: raw.plan.trim() };
}
