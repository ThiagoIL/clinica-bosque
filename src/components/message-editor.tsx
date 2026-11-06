"use client";

import { useRef, useState } from "react";
import { useFieldError, useReadOnly } from "@/components/ui/form-kit";
import { SAMPLE_VARS, TEMPLATE_VARIABLES, renderTemplate } from "@/lib/whatsapp";

/**
 * Texto do modelo de mensagem: caixa de texto, botões que inserem as variáveis na posição do cursor
 * e uma prévia (como o paciente vai ler) com dados de exemplo. Vai dentro de um ActionForm.
 */
export function MessageEditor({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [text, setText] = useState(defaultValue ?? "");
  const field = useRef<HTMLTextAreaElement>(null);
  const error = useFieldError(name);
  const readOnly = useReadOnly();

  function insert(key: string) {
    const el = field.current;
    const token = `{${key}}`;
    if (!el) return setText((t) => t + token);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + token + text.slice(end));
    // devolve o cursor para depois da variável inserida
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label htmlFor={name} className="label">
          Mensagem<span className="ml-0.5 text-red-500">*</span>
        </label>
        <textarea
          ref={field}
          id={name}
          name={name}
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={readOnly}
          maxLength={1500}
          aria-invalid={error ? true : undefined}
          className="input resize-y"
        />
        {error ? (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        ) : (
          <p className="mt-1 text-xs text-muted">Clique em uma variável para inserir no texto. Ela é trocada pelos dados do atendimento ao enviar.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insert(v.key)}
              disabled={readOnly}
              title={`${v.label} — exemplo: ${v.sample}`}
              className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-brand-800 hover:bg-black/5 disabled:opacity-50"
            >
              {`{${v.key}}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label">Prévia (dados de exemplo)</p>
        <div className="rounded-xl bg-[#e7f6dc] p-3 text-sm leading-relaxed text-ink shadow-xs">
          <p className="whitespace-pre-wrap break-words">
            {text.trim() ? renderTemplate(text, SAMPLE_VARS) : <span className="text-muted">A mensagem aparece aqui.</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
