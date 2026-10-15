import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "bosque_session";

/** Barreira de acesso: sem sessão válida, tudo (exceto login e health) redireciona para /login. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  let authenticated = false;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (pathname === "/login") {
    return authenticated ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!authenticated) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Arquivos estáticos (logo, ícones) precisam carregar na tela de login, antes da sessão.
  matcher: ["/((?!_next/static|_next/image|api/health|.*\\.(?:jpg|jpeg|png|svg|ico|webp)$).*)"],
};
