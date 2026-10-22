"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const ITEMS = [
  { href: "/", label: "Status do sistema" },
  { href: "/modulos", label: "Módulos" },
  { href: "/conta", label: "Minha conta" },
];

/** `base` é o prefixo do console na URL ("" no domínio dedicado, ex.: "/sistema-admin" no modo por caminho). */
export function PlatformNav({ base }: { base: string }) {
  // o navegador vê os caminhos sem o prefixo interno /platform (o proxy faz o rewrite)
  const current = usePathname();
  const pathname = (base && current.startsWith(base) ? current.slice(base.length) : current).replace(/^\/platform/, "") || "/";
  return (
    <nav className="flex gap-1">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={`${base}${item.href === "/" && base ? "" : item.href}` || "/"}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              active ? "bg-white/15 font-medium text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
