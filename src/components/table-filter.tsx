"use client";

import { useState } from "react";
import { Search } from "lucide-react";

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Pesquisa na própria tela, sem recarregar: esconde as linhas `[data-filter-row]` do bloco `#target` que não têm
 * o texto digitado. As linhas continuam na página (os campos escondidos ainda são enviados no formulário),
 * por isso serve para a tabela de preços, que salva tudo de uma vez.
 */
export function TableFilter({ target, placeholder = "Buscar…" }: { target: string; placeholder?: string }) {
  const [text, setText] = useState("");

  function apply(value: string) {
    setText(value);
    const tokens = normalize(value).split(/\s+/).filter(Boolean);
    document.querySelectorAll<HTMLElement>(`#${target} [data-filter-row]`).forEach((row) => {
      const haystack = normalize(row.dataset.filterRow ?? row.textContent ?? "");
      row.hidden = !tokens.every((t) => haystack.includes(t));
    });
  }

  return (
    <div className="relative mb-4 max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search" value={text} onChange={(e) => apply(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        autoComplete="off" className="input pl-9"
        // Enter aqui não deve salvar a tabela de preços
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      />
    </div>
  );
}
