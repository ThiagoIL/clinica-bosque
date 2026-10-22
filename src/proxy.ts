import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { hasAccess, loadSnapshot } from "@/lib/access";
import { moduleForPath } from "@/lib/modules";

const SESSION_COOKIE = "bosque_session";
const PLATFORM_COOKIE = "bosque_platform";

/**
 * Porta de entrada de todas as requisições:
 *  - domínio de administração (PLATFORM_ADMIN_HOSTS) → console do fornecedor (/platform/*);
 *  - domínio da clínica → sistema, com sessão, bloqueio e permissões por módulo.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = hostOf(request);

  if (isPlatformHost(host)) return handlePlatform(request);

  // o console do fornecedor não existe no domínio da clínica
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  return handleClinic(request);
}

// ───────────────────────── domínio da clínica ─────────────────────────

async function handleClinic(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const readOnlyMethod = request.method === "GET" || request.method === "HEAD";
  const userId = await verifiedSubject(request.cookies.get(SESSION_COOKIE)?.value, false);

  let snapshot;
  try {
    snapshot = await loadSnapshot(userId);
  } catch (error) {
    console.error("[proxy] falha ao consultar o acesso:", error);
    return new NextResponse("Serviço indisponível", { status: 503 });
  }

  // Sistema bloqueado pelo fornecedor: tudo leva à tela de bloqueio.
  if (snapshot.blocked) {
    if (pathname === "/bloqueado" || !readOnlyMethod) return NextResponse.next();
    return NextResponse.redirect(new URL("/bloqueado", request.url));
  }
  if (pathname === "/bloqueado") return NextResponse.redirect(new URL("/", request.url));

  const authenticated = !!userId && !!snapshot.user?.active;

  if (pathname === "/login") {
    return authenticated ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!authenticated) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    const response = NextResponse.redirect(url);
    if (userId) response.cookies.delete(SESSION_COOKIE); // usuário removido ou desativado
    return response;
  }

  // Permissão por módulo nas telas (as ações do servidor conferem o nível "Edita" por conta própria).
  if (readOnlyMethod) {
    const needed = moduleForPath(pathname);
    if (needed && !hasAccess(snapshot, needed)) {
      return NextResponse.redirect(new URL("/?acesso=negado", request.url));
    }
  }
  return NextResponse.next();
}

// ───────────────────────── domínio de administração ─────────────────────────

async function handlePlatform(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const publicPath = pathname.startsWith("/platform") ? pathname.slice("/platform".length) || "/" : pathname;
  const internal = `/platform${publicPath === "/" ? "" : publicPath}`;

  const adminId = await verifiedSubject(request.cookies.get(PLATFORM_COOKIE)?.value, true);

  if (publicPath === "/login") {
    return adminId
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.rewrite(new URL(`${internal}${search}`, request.url));
  }
  if (!adminId) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.rewrite(new URL(`${internal}${search}`, request.url));
}

// ───────────────────────── utilitários ─────────────────────────

function hostOf(request: NextRequest): string {
  const raw = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

function isPlatformHost(host: string): boolean {
  const configured = (process.env.PLATFORM_ADMIN_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (configured.includes(host)) return true;
  // facilita o desenvolvimento local: http://admin.localhost:3000
  return process.env.NODE_ENV !== "production" && host.startsWith("admin.localhost");
}

/** Valida o JWT da sessão e devolve o id (sub). `platform` indica a audiência esperada. */
async function verifiedSubject(token: string | undefined, platform: boolean): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const isPlatformToken = payload.aud === "platform";
    if (isPlatformToken !== platform) return null; // sessões de um domínio não valem no outro
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export const config = {
  // Arquivos estáticos (logo, ícones) precisam carregar na tela de login, antes da sessão.
  matcher: ["/((?!_next/static|_next/image|api/health|.*\\.(?:jpg|jpeg|png|svg|ico|webp)$).*)"],
};
