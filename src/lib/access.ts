// Estado de acesso: sistema bloqueado, módulos liberados e permissões do usuário.
// Sem "server-only" porque é usado também pelo proxy (runtime Node).
import { db } from "@/lib/db";
import {
  DEFAULT_ENABLED_MODULES, levelFor, parseEnabledModules, parsePermissions,
  type Access, type Level, type ModuleKey, type Permissions,
} from "@/lib/modules";

export type AccessSnapshot = {
  blocked: boolean;
  blockMessage: string | null;
  enabled: ModuleKey[];
  user: { id: string; role: "ADMIN" | "STAFF"; active: boolean; canSeeFinance: boolean; permissions: Permissions } | null;
};

const TTL_MS = 3000;
const cache = new Map<string, { at: number; value: AccessSnapshot }>();

/**
 * Lê (com cache curto de 3 s) o estado do sistema e do usuário.
 * O cache evita uma consulta a cada prefetch; mudanças valem em poucos segundos.
 */
export async function loadSnapshot(userId: string | null): Promise<AccessSnapshot> {
  const key = userId ?? "anon";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const [settings, user] = await Promise.all([
    db.systemSettings.findUnique({ where: { id: "singleton" } }),
    userId
      ? db.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, active: true, canSeeFinance: true, accessProfile: { select: { permissions: true } } },
        })
      : null,
  ]);

  const value: AccessSnapshot = {
    blocked: settings?.blocked ?? false,
    blockMessage: settings?.blockMessage ?? null,
    enabled: settings ? parseEnabledModules(settings.enabledModules) : DEFAULT_ENABLED_MODULES,
    user: user
      ? {
          id: user.id,
          role: user.role,
          active: user.active,
          canSeeFinance: user.canSeeFinance,
          permissions: parsePermissions(user.accessProfile?.permissions),
        }
      : null,
  };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 200) cache.clear();
  return value;
}

/** Descarta o cache (após o fornecedor bloquear/liberar ou alterar módulos, nesta instância). */
export function clearAccessCache() {
  cache.clear();
}

export function levelOf(snapshot: AccessSnapshot, module: ModuleKey): Level {
  if (!snapshot.user?.active) return "NONE";
  // o usuário sem permissão para ver o financeiro não o acessa, mesmo que o perfil libere o módulo
  if (module === "FINANCEIRO" && snapshot.user.role === "STAFF" && !snapshot.user.canSeeFinance) return "NONE";
  return levelFor({ role: snapshot.user.role, permissions: snapshot.user.permissions, enabled: snapshot.enabled }, module);
}

/** Verifica se o usuário pode acessar `needed` (um módulo com nível mínimo, ou "ADMIN"). */
export function hasAccess(snapshot: AccessSnapshot, needed: Access, minimum: Level = "VIEW"): boolean {
  if (!snapshot.user?.active) return false;
  if (needed === "ADMIN") return snapshot.user.role === "ADMIN";
  const level = levelOf(snapshot, needed);
  return minimum === "VIEW" ? level !== "NONE" : level === "EDIT";
}
