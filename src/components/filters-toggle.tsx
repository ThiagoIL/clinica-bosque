"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";

/** Parâmetros da URL que não são filtros (paginação, edição, janela aberta, visão da agenda). */
const NOT_FILTERS = new Set(["page", "edit", "a", "view", "date"]);

/**
 * No celular os filtros ficam recolhidos atrás de um botão "Filtros" (mostra quantos estão ativos);
 * a partir do tablet aparecem sempre abertos.
 */
export function FiltersToggle({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const active = [...params.entries()].filter(([key, value]) => value && !NOT_FILTERS.has(key)).length;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn btn-outline mb-3 w-full justify-between md:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="size-4" />
          Filtros
          {active > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{active}</span>}
        </span>
        <ChevronDown className={clsx("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div className={clsx(!open && "hidden md:block")}>{children}</div>
    </div>
  );
}
