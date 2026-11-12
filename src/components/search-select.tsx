"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import clsx from "clsx";

export type SearchOption = { value: string; label: string };

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Lista de escolha com pesquisa: digita-se parte do nome (sem precisar de acento ou maiúscula) e a lista filtra.
 * Envia o valor escolhido num campo escondido com o `name` informado, então funciona em formulários comuns,
 * em filtros (GET) e em formulários de server action. Pode ser controlado (`value` + `onChange`) ou não.
 */
export function SearchSelect({
  name, options, value, defaultValue, onChange, placeholder = "Digite para buscar…", emptyLabel,
  allowEmpty = true, disabled, invalid, id, maxItems = 50,
}: {
  name: string;
  options: SearchOption[];
  value?: string;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Texto mostrado no campo vazio (ex.: "Todas"). Padrão: o placeholder. */
  emptyLabel?: string;
  /** Permite limpar a escolha (mostra o botão ×). */
  allowEmpty?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  /** Quantas opções aparecem de uma vez; o resto aparece ao refinar a pesquisa. */
  maxItems?: number;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : inner;
  const selected = options.find((o) => o.value === current) ?? null;

  const [query, setQuery] = useState<string | null>(null); // null = não está digitando
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const indexed = useMemo(() => options.map((o) => ({ o, n: normalize(o.label) })), [options]);
  const matches = useMemo(() => {
    const tokens = normalize(query ?? "").split(/\s+/).filter(Boolean);
    return tokens.length === 0 ? indexed : indexed.filter(({ n }) => tokens.every((t) => n.includes(t)));
  }, [indexed, query]);
  const shown = matches.slice(0, maxItems);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(next: string) {
    if (value === undefined) setInner(next);
    onChange?.(next);
    setQuery(null);
    setOpen(false);
  }

  function close() {
    // saiu do campo: se apagou o texto e pode ficar vazio, limpa; senão volta ao item escolhido
    if (query === "" && allowEmpty && current) choose("");
    setQuery(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault(); // escolhe a opção em vez de enviar o formulário
      choose(shown[active].o.value);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setQuery(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={current} />
      <input
        id={id ?? name}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        disabled={disabled}
        value={query ?? selected?.label ?? ""}
        placeholder={selected ? undefined : (emptyLabel ?? placeholder)}
        onFocus={(e) => {
          setOpen(true);
          setActive(Math.max(0, indexed.findIndex(({ o }) => o.value === current)));
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
        className={clsx("input pr-14", invalid && "border-red-400")}
      />
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-muted">
        {allowEmpty && current && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Limpar"
            onMouseDown={(e) => {
              e.preventDefault();
              choose("");
            }}
            className="pointer-events-auto rounded p-0.5 hover:bg-black/5 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
        <ChevronDown className="size-4" />
      </div>

      {open && !disabled && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-lg"
        >
          {shown.length === 0 && <li className="px-3 py-2 text-muted">Nada encontrado</li>}
          {shown.map(({ o }, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === current}
              data-index={i}
              onMouseDown={(e) => {
                e.preventDefault(); // não tira o foco do campo antes de escolher
                choose(o.value);
              }}
              onMouseEnter={() => setActive(i)}
              className={clsx(
                "cursor-pointer px-3 py-1.5",
                i === active && "bg-brand-50",
                o.value === current && "font-medium text-brand-800",
              )}
            >
              {o.label}
            </li>
          ))}
          {matches.length > shown.length && (
            <li className="px-3 py-1.5 text-xs text-muted">
              Mostrando {shown.length} de {matches.length}. Digite mais para refinar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
