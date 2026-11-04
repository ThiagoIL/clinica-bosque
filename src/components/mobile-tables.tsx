"use client";

import { useEffect } from "react";

/**
 * No celular as tabelas viram cartões (um por linha). Para cada valor aparecer com o nome da coluna,
 * copia o texto do cabeçalho para um atributo `data-label` em cada célula; o CSS faz o resto.
 * Refaz quando a tela muda (nova página, filtro, linhas novas).
 */
export function MobileTables() {
  useEffect(() => {
    const apply = () => {
      for (const table of document.querySelectorAll<HTMLTableElement>("table.table")) {
        const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
        for (const row of table.querySelectorAll("tbody tr, tfoot tr")) {
          const first = row.firstElementChild;
          if (!first || first.hasAttribute("data-label")) continue; // linha já marcada
          let col = 0;
          for (const cell of Array.from(row.children) as HTMLTableCellElement[]) {
            cell.setAttribute("data-label", cell.colSpan > 1 ? "" : (heads[col] ?? ""));
            col += cell.colSpan || 1;
          }
        }
        if (!table.hasAttribute("data-cards")) table.setAttribute("data-cards", "");
      }
    };
    apply();
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
