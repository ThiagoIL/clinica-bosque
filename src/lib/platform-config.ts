// Onde o console do fornecedor responde. Sem dependências de servidor: usado também pelo proxy.

/** Header interno com o prefixo do console na requisição atual ("" no modo por domínio). */
export const PLATFORM_BASE_HEADER = "x-platform-base";

const DEFAULT_PATH = "/sistema-admin";

// Caminhos que o console nunca pode ocupar (pertencem ao sistema da clínica ou ao Next).
const RESERVED = ["/login", "/api", "/_next", "/platform", "/bloqueado", "/conta", "/usuarios", "/perfis"];

/**
 * Caminho do console dentro do domínio da clínica (ex.: "/sistema-admin"), definido por PLATFORM_ADMIN_PATH.
 * Padrão: "/sistema-admin". Use "off" para desativar esse modo. Recomenda-se escolher um caminho pouco óbvio.
 */
export function platformBasePath(): string | null {
  const raw = process.env.PLATFORM_ADMIN_PATH?.trim();
  if (raw && raw.toLowerCase() === "off") return null;
  const normalized = `/${(raw || DEFAULT_PATH).replace(/^\/+|\/+$/g, "")}`;
  if (normalized === "/" || RESERVED.some((r) => normalized === r || normalized.startsWith(`${r}/`))) return null;
  return normalized;
}

/** Domínio(s) dedicados ao console (PLATFORM_ADMIN_HOSTS), opcional. */
export function isPlatformHost(host: string): boolean {
  const configured = (process.env.PLATFORM_ADMIN_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (configured.includes(host)) return true;
  // facilita o desenvolvimento local: http://admin.localhost:3000
  return process.env.NODE_ENV !== "production" && host.startsWith("admin.localhost");
}

/** Se `pathname` está sob o caminho do console, devolve o caminho interno do console ("/", "/modulos"…). */
export function stripPlatformBase(pathname: string, base: string | null): string | null {
  if (!base) return null;
  if (pathname === base) return "/";
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : null;
}
