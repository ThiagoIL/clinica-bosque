"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutGrid, Menu, ShieldCheck, UserCog, Users, X, type LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Status do sistema", icon: ShieldCheck },
  { href: "/usuarios", label: "Usuários", icon: Users },
  { href: "/modulos", label: "Módulos", icon: LayoutGrid },
  { href: "/conta", label: "Minha conta", icon: UserCog },
];

/**
 * Estrutura do console: barra lateral à esquerda (como no sistema da clínica).
 * `base` é o prefixo do console na URL ("" no domínio dedicado, ex.: "/sistema-admin" no modo por caminho).
 */
export function PlatformShell({ base, footer, children }: { base: string; footer: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const current = usePathname();
  // o navegador vê os caminhos sem o prefixo interno /platform (o proxy faz o rewrite)
  const pathname = (base && current.startsWith(base) ? current.slice(base.length) : current).replace(/^\/platform/, "") || "/";

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="grid size-10 place-items-center rounded-lg bg-accent-500">
          <ShieldCheck className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="font-semibold">Administração</p>
          <p className="text-xs text-slate-400">Clínica Bosque</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={`${base}${href === "/" && base ? "" : href}` || "/"}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-white/12 font-medium text-white" : "text-slate-300 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className={clsx("size-4 shrink-0", active && "text-accent-400")} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">{footer}</div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="btn btn-ghost -ml-2 p-2" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        <span className="font-semibold">Administração do sistema</span>
        <span className="w-9" />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 rounded p-1 text-slate-300 hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
