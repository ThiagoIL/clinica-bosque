import ExcelJS from "exceljs";
import { z } from "zod";
import { onlyDigits } from "@/lib/cpf";
import { titleCaseName } from "@/lib/names";
import { cpf, digits, email, optional, optionalEnum, required } from "@/lib/form";

/** Máximo de linhas por planilha (evita travar o servidor com um arquivo gigante). */
export const MAX_IMPORT_ROWS = 10000;

type FieldKey =
  | "name" | "socialName" | "cpf" | "rg" | "birthDate" | "sex" | "occupation" | "phone" | "phone2" | "email"
  | "zipCode" | "street" | "number" | "complement" | "neighborhood" | "city" | "state"
  | "plan" | "insuranceNumber" | "guardianName" | "guardianPhone" | "emergencyContact"
  | "status" | "registeredAt" | "observations";

/**
 * Colunas da planilha: título (como no modelo), nome interno e outros títulos aceitos (sem acento/maiúscula/pontuação).
 * Os títulos extras cobrem exportações de outros sistemas (ex.: "Telefone Celular", "Convênio/Particular").
 */
export const IMPORT_COLUMNS: { key: FieldKey; title: string; width: number; help: string; aliases: string[] }[] = [
  { key: "name", title: "Nome", width: 34, help: "Obrigatório. Vira minúsculas com a 1ª letra de cada nome em maiúscula.", aliases: ["nomecompleto", "paciente", "nomedopaciente"] },
  { key: "socialName", title: "Nome social", width: 24, help: "Opcional.", aliases: [] },
  { key: "cpf", title: "CPF", width: 16, help: "Opcional. Com ou sem pontos. CPF repetido não é importado de novo.", aliases: [] },
  { key: "rg", title: "RG", width: 14, help: "Opcional.", aliases: [] },
  { key: "birthDate", title: "Data de nascimento", width: 20, help: "Opcional. Formato dd/mm/aaaa (ou uma célula de data do Excel).", aliases: ["nascimento", "datanascimento", "dtnascimento"] },
  { key: "sex", title: "Sexo", width: 12, help: "Opcional. F / Feminino, M / Masculino ou Outro.", aliases: ["genero"] },
  { key: "occupation", title: "Profissão", width: 22, help: "Opcional.", aliases: ["ocupacao"] },
  { key: "phone", title: "Telefone", width: 18, help: "Opcional. Com DDD; é o número usado no WhatsApp.", aliases: ["celular", "telefone1", "telefonecelular", "whatsapp", "fone"] },
  { key: "phone2", title: "Telefone 2", width: 18, help: "Opcional. Telefone fixo ou outro celular.", aliases: ["celular2", "fone2", "telefonefixo"] },
  { key: "email", title: "E-mail", width: 28, help: "Opcional.", aliases: ["email"] },
  { key: "zipCode", title: "CEP", width: 12, help: "Opcional.", aliases: [] },
  { key: "street", title: "Rua", width: 30, help: "Opcional. Se o número vier junto no fim (“Rua Tal 123”), ele é separado.", aliases: ["endereco", "logradouro"] },
  { key: "number", title: "Número", width: 10, help: "Opcional.", aliases: ["num"] },
  { key: "complement", title: "Complemento", width: 16, help: "Opcional.", aliases: [] },
  { key: "neighborhood", title: "Bairro", width: 20, help: "Opcional.", aliases: [] },
  { key: "city", title: "Cidade", width: 20, help: "Opcional.", aliases: ["municipio"] },
  { key: "state", title: "UF", width: 6, help: "Opcional. Duas letras (SP, RJ…).", aliases: ["estado"] },
  { key: "plan", title: "Plano de saúde", width: 20, help: "Opcional. Igual ao cadastrado em Planos de saúde; em branco ou “Particular” = Particular.", aliases: ["plano", "convenio", "convenioparticular"] },
  { key: "insuranceNumber", title: "Carteirinha", width: 18, help: "Opcional. Número da carteirinha do plano.", aliases: ["numerocarteirinha", "carteira"] },
  { key: "guardianName", title: "Responsável", width: 26, help: "Opcional. Nome do responsável.", aliases: ["nomedoresponsavel", "responsavelpelopaciente"] },
  { key: "guardianPhone", title: "Telefone do responsável", width: 22, help: "Opcional.", aliases: ["telefoneresponsavel", "foneresponsavel"] },
  { key: "emergencyContact", title: "Contato de emergência", width: 26, help: "Opcional. Nome de um parente ou contato.", aliases: ["nomedeumparente", "parente"] },
  { key: "status", title: "Situação", width: 12, help: "Opcional. Ativo ou Inativo; em branco = Ativo.", aliases: ["status"] },
  { key: "registeredAt", title: "Data do cadastro", width: 18, help: "Opcional. Mantém a data em que o paciente foi cadastrado antes (dd/mm/aaaa).", aliases: ["datadecadastro", "cadastradoem"] },
  { key: "observations", title: "Observações", width: 30, help: "Opcional.", aliases: ["observacao", "obs"] },
];

const simplify = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADER_LOOKUP = new Map<string, FieldKey>(
  IMPORT_COLUMNS.flatMap((c) => [c.title, ...c.aliases].map((t) => [simplify(t), c.key] as const)),
);

/** Sistemas antigos exportam "-" (ou só espaços) para campo sem informação. */
function isPlaceholder(text: string): boolean {
  const t = text.trim();
  return t === "" || /^[-–—.?\s]+$/.test(t) || /^(n\/?a|nd|n[aã]o informado|sem informa[cç][aã]o)$/i.test(t);
}

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

export class SheetError extends Error {}

export type ImportRow = { line: number; raw: Record<FieldKey, string> };

/** Lê a primeira aba da planilha: acha a linha de títulos e devolve as linhas preenchidas. */
export async function readPatientSheet(file: Buffer): Promise<ImportRow[]> {
  // .xls antigo (formato binário do Excel 97-2003) não é lido: precisa ser salvo como .xlsx
  if (file.length > 4 && file[0] === 0xd0 && file[1] === 0xcf && file[2] === 0x11 && file[3] === 0xe0) {
    throw new SheetError("Este arquivo está no formato antigo do Excel (.xls). Abra no Excel e use “Salvar como” → Pasta de Trabalho do Excel (.xlsx).");
  }
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
    const row = sheet.getRow(r);
    const raw = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, ""])) as Record<FieldKey, string>;
    let filled = false;
    columns.forEach((key, col) => {
      const text = cellText(row.getCell(col).value);
      if (isPlaceholder(text)) return;
      raw[key] = text.trim();
      filled = true;
    });
    if (filled) rows.push({ line: r, raw });
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new SheetError(`A planilha tem mais de ${MAX_IMPORT_ROWS} pacientes. Divida em arquivos menores.`);
    }
  }
  return rows;
}

/** Planilha modelo: títulos na primeira linha e uma aba com as instruções. */
export async function buildPatientTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pacientes", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = IMPORT_COLUMNS.map((c) => ({ header: c.title, key: c.key, width: c.width }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF667B35" } };
  // CPF, telefones, CEP e RG como texto, para o Excel não cortar zeros à esquerda
  for (const key of ["cpf", "rg", "phone", "phone2", "zipCode", "guardianPhone", "number", "insuranceNumber"] as const) {
    sheet.getColumn(key).numFmt = "@";
  }

  const help = workbook.addWorksheet("Instruções", { properties: { tabColor: { argb: "FF667B35" } } });
  help.columns = [{ header: "Coluna", key: "c", width: 26 }, { header: "Como preencher", key: "h", width: 90 }];
  help.getRow(1).font = { bold: true };
  for (const c of IMPORT_COLUMNS) help.addRow({ c: c.title, h: c.help });
  help.addRow({});
  help.addRow({
    c: "Importante",
    h: "Preencha a aba “Pacientes” a partir da linha 2 (a linha 1 são os títulos). Células com “-” são tratadas como vazias. Pacientes com CPF já cadastrado, ou com o mesmo nome e data de nascimento, são ignorados. Você também pode enviar uma planilha exportada de outro sistema: as colunas são reconhecidas pelo título.",
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ───────────────────────── limpeza e validação de cada linha ─────────────────────────

const SEX_MAP: Record<string, "FEMALE" | "MALE" | "OTHER"> = {
  f: "FEMALE", fem: "FEMALE", feminino: "FEMALE", mulher: "FEMALE",
  m: "MALE", masc: "MALE", masculino: "MALE", homem: "MALE",
  o: "OTHER", outro: "OTHER", outra: "OTHER", outros: "OTHER",
};

/** dd/mm/aaaa, aaaa-mm-dd ou dd/mm/aa → aaaa-mm-dd; "" se vazio; "invalid" se não existir no calendário. */
function parseDate(text: string): string {
  const t = text.trim();
  if (!t) return "";
  let year: number, month: number, day: number;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})(?:\s.*)?$/);
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

/** Zeros à esquerda de CPF/CEP que a planilha transformou em número. */
function padDigits(text: string, size: number, min: number): string {
  const d = onlyDigits(text);
  return d.length >= min && d.length < size ? d.padStart(size, "0") : text;
}

/** Nome limpo: sem símbolo sobrando no começo (ex.: "?Ágata"), minúsculas com a 1ª letra de cada nome em maiúscula. */
function cleanName(text: string): string {
  return titleCaseName(text.replace(/^[^A-Za-zÀ-ÿ]+/, ""));
}

/** "Rua das Flores 12" → rua "Rua das Flores" e número "12" (só quando o número vem no fim). */
function splitAddress(text: string): { street: string; number: string } {
  const m = text.match(/^(.*?[A-Za-zÀ-ÿ.])[\s,]+(?:n[ºo°.]?\s*)?(\d{1,6}[A-Za-z]?)\s*$/i);
  return m && m[1].trim().length >= 6 ? { street: m[1].trim(), number: m[2] } : { street: text, number: "" };
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max).trim() : text);

const schema = z.object({
  name: required("Nome", 150),
  socialName: optional(150),
  cpf: cpf(),
  rg: optional(30),
  birthDate: z.string().transform((v) => v || null).refine((v) => v === null || v !== "invalid", "Data de nascimento inválida"),
  sex: optionalEnum(["FEMALE", "MALE", "OTHER"] as const),
  occupation: optional(100),
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
  healthInsuranceNumber: optional(60),
  guardianName: optional(150),
  guardianPhone: digits(11),
  emergencyContactName: optional(150),
  observations: optional(5000),
});

export type PatientImportData = Omit<z.output<typeof schema>, "birthDate"> & {
  birthDate: string | null;
  active: boolean;
  /** Data em que o paciente foi cadastrado no sistema de origem (aaaa-mm-dd), se informada. */
  createdAt: string | null;
};

const LABELS: Record<string, string> = {
  ...Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.title])),
  healthInsuranceNumber: "Carteirinha",
  emergencyContactName: "Contato de emergência",
};
/** Campo da planilha de onde vem cada campo validado (para mostrar o valor original no aviso). */
const SOURCE: Record<string, FieldKey> = { healthInsuranceNumber: "insuranceNumber", emergencyContactName: "emergencyContact" };

export type NormalizedRow =
  | { data: PatientImportData; plan: string; warnings: string[] }
  | { errors: string[] };

/**
 * Limpa e valida uma linha. Só o nome é indispensável: um campo opcional inválido (CPF, e-mail, data…)
 * é ignorado e vira um aviso, para não perder o paciente por causa de um dado ruim.
 */
export function normalizeRow(raw: Record<FieldKey, string>): NormalizedRow {
  const address = raw.number ? { street: raw.street, number: raw.number } : splitAddress(raw.street);
  const sexKey = simplify(raw.sex);
  const state = /^[A-Za-z]{2}$/.test(raw.state.trim()) ? raw.state.trim().toUpperCase() : ""; // "-1" e afins viram vazio
  const input: Record<string, string> = {
    name: clip(cleanName(raw.name), 150),
    socialName: clip(cleanName(raw.socialName), 150),
    cpf: padDigits(raw.cpf, 11, 9),
    rg: clip(raw.rg, 30),
    birthDate: parseDate(raw.birthDate),
    sex: sexKey ? (SEX_MAP[sexKey] ?? "?") : "",
    occupation: clip(raw.occupation, 100),
    phone: localPhone(raw.phone),
    phone2: localPhone(raw.phone2),
    email: raw.email.replace(/^mailto:/i, "").trim().toLowerCase(),
    zipCode: padDigits(raw.zipCode, 8, 5),
    street: clip(titleCaseName(address.street), 150),
    number: clip(address.number, 20),
    complement: clip(raw.complement, 100),
    neighborhood: clip(titleCaseName(raw.neighborhood), 100),
    city: clip(titleCaseName(raw.city), 100),
    state,
    healthInsuranceNumber: clip(raw.insuranceNumber, 60),
    guardianName: clip(cleanName(raw.guardianName), 150),
    guardianPhone: localPhone(raw.guardianPhone),
    emergencyContactName: clip(cleanName(raw.emergencyContact), 150),
    observations: clip(raw.observations, 5000),
  };

  const warnings: string[] = [];
  let result = schema.safeParse(input);
  if (!result.success) {
    const bad = new Set(result.error.issues.map((i) => String(i.path[0] ?? "")));
    if (bad.has("name")) return { errors: [input.name ? "Nome inválido" : "Nome é obrigatório"] };
    for (const key of bad) {
      const original = raw[SOURCE[key] ?? (key as FieldKey)] ?? "";
      warnings.push(`${LABELS[key] ?? key}${original ? ` “${original}”` : ""} inválido(a): ignorado`);
      input[key] = "";
    }
    result = schema.safeParse(input);
    if (!result.success) return { errors: [result.error.issues[0]?.message ?? "Dados inválidos"] };
  }

  const status = simplify(raw.status);
  const created = parseDate(raw.registeredAt);
  const data: PatientImportData = {
    ...(result.data as Omit<PatientImportData, "active" | "createdAt">),
    active: !["inativo", "inativa", "desativado", "desativada", "nao", "0", "false"].includes(status),
    createdAt: created && created !== "invalid" ? created : null,
  };
  // "Particular" é o plano padrão: tratado como sem plano informado
  const plan = /^particular$/i.test(raw.plan.trim()) ? "" : raw.plan.trim();
  return { data, plan, warnings };
}
