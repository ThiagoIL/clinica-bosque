// Módulos do sistema e níveis de acesso. Sem dependências de servidor: usado também no cliente e no proxy.

export const MODULES = [
  { key: "AGENDA", label: "Agenda", description: "Agenda de atendimentos (dia, semana, mês) e controle de presença.", paths: ["/agenda"] },
  { key: "LANCAMENTOS", label: "Lançamentos", description: "Lançamento de consultas, retornos, sessões e terapias com agendamento recorrente.", paths: ["/lancamentos"] },
  { key: "PACIENTES", label: "Pacientes", description: "Cadastro completo dos pacientes.", paths: ["/pacientes"] },
  { key: "PROFISSIONAIS", label: "Profissionais", description: "Cadastro dos médicos e terapeutas.", paths: ["/profissionais"] },
  { key: "FINANCEIRO", label: "Financeiro", description: "Contas a receber, contas a pagar, extrato, fluxo de caixa, contas e categorias.", paths: ["/financeiro"] },
  { key: "CADASTROS", label: "Cadastros", description: "Serviços, especialidades, planos de saúde e tabela de preços.", paths: ["/servicos", "/especialidades", "/planos", "/precos"] },
  { key: "CONTRATOS", label: "Colaboradores e contratos", description: "Cadastro de colaboradores/fornecedores e gestão dos contratos (ativos e encerrados) com anexos.", paths: ["/colaboradores", "/contratos"] },
  { key: "ESTOQUE", label: "Estoque", description: "Itens, saldo, entradas, saídas e ajustes de estoque.", paths: ["/estoque"] },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type Level = "NONE" | "VIEW" | "EDIT";
export type Permissions = Partial<Record<ModuleKey, Level>>;
export type Access = ModuleKey | "ADMIN";

export const MODULE_KEYS = MODULES.map((m) => m.key) as ModuleKey[];

/** Módulos liberados por padrão em uma instalação nova (Estoque fica desligado). */
export const DEFAULT_ENABLED_MODULES: ModuleKey[] = MODULE_KEYS.filter((k) => k !== "ESTOQUE");

export const LEVEL_LABELS: Record<Level, string> = { NONE: "Sem acesso", VIEW: "Consulta", EDIT: "Edita" };

export const moduleLabel = (key: string) => MODULES.find((m) => m.key === key)?.label ?? key;

/** Caminhos exclusivos do administrador da empresa. */
const ADMIN_PATHS = ["/usuarios", "/perfis"];

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Módulo (ou "ADMIN") responsável por um caminho; null = livre para qualquer usuário logado. */
export function moduleForPath(pathname: string): Access | null {
  if (ADMIN_PATHS.some((p) => under(pathname, p))) return "ADMIN";
  for (const m of MODULES) if (m.paths.some((p) => under(pathname, p))) return m.key;
  return null;
}

export function parsePermissions(value: unknown): Permissions {
  const result: Permissions = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of MODULE_KEYS) {
      const level = (value as Record<string, unknown>)[key];
      if (level === "VIEW" || level === "EDIT") result[key] = level;
    }
  }
  return result;
}

export function parseEnabledModules(value: unknown): ModuleKey[] {
  return Array.isArray(value) ? MODULE_KEYS.filter((k) => value.includes(k)) : [];
}

export const atLeast = (level: Level, needed: Level) =>
  needed === "NONE" || (needed === "VIEW" ? level !== "NONE" : level === "EDIT");

/** Nível efetivo de um usuário em um módulo, considerando o que o fornecedor liberou. */
export function levelFor(
  subject: { role: "ADMIN" | "STAFF"; permissions: Permissions; enabled: ModuleKey[] },
  module: ModuleKey,
): Level {
  if (!subject.enabled.includes(module)) return "NONE";
  if (subject.role === "ADMIN") return "EDIT";
  return subject.permissions[module] ?? "NONE";
}
