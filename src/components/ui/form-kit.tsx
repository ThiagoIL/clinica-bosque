"use client";

import {
  createContext, startTransition, useActionState, useContext, useEffect, useRef, useState,
  type ChangeEvent, type FormEvent, type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { FormState } from "@/lib/form";

const FormCtx = createContext<{ state: FormState; pending: boolean; readOnly: boolean }>({ state: {}, pending: false, readOnly: false });

/** Quando verdadeiro (perfil só de consulta), todos os formulários abaixo ficam desabilitados. */
const ReadOnlyCtx = createContext(false);
export function ReadOnlyProvider({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return <ReadOnlyCtx.Provider value={readOnly}>{children}</ReadOnlyCtx.Provider>;
}

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Formulário ligado a uma server action. O envio é feito via onSubmit (e não via
 * `action=`) para que o React não limpe os campos quando a action retorna um erro.
 */
export function ActionForm({
  action,
  children,
  className,
  hideMessages,
  resetOnSuccess,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  hideMessages?: boolean;
  /** Limpa os campos quando a action retorna sucesso (ex.: adicionar anotação). */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const formRef = useRef<HTMLFormElement>(null);
  const readOnly = useContext(ReadOnlyCtx);

  useEffect(() => {
    if (resetOnSuccess && state.success && !state.error) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(data));
  }

  return (
    <FormCtx.Provider value={{ state, pending, readOnly }}>
      <form ref={formRef} onSubmit={onSubmit} className={className}>
        {!hideMessages && state.error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p>{state.error}</p>
              {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {Object.values(state.fieldErrors).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {!hideMessages && state.success && !state.error && (
          <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{state.success}</span>
          </div>
        )}
        {children}
      </form>
    </FormCtx.Provider>
  );
}

type ButtonProps = {
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "outline" | "danger";
  size?: "sm";
  name?: string;
  value?: string;
};

export function SubmitButton({ children = "Salvar", className, variant = "primary", size, name, value }: ButtonProps) {
  const { pending, readOnly } = useContext(FormCtx);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || readOnly}
      className={clsx("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Botão de submit que pede confirmação antes de enviar. */
export function ConfirmSubmit({
  children,
  message,
  className,
  variant = "danger",
  size = "sm",
  name,
  value,
}: ButtonProps & { message: string; children: ReactNode }) {
  const { pending, readOnly } = useContext(FormCtx);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || readOnly}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={clsx("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)}
    >
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/**
 * "Excluir" para linhas de tabela: pede confirmação, executa a action e avisa
 * quando a exclusão é barrada (ex.: registro em uso).
 */
export function DeleteButton({
  action,
  id,
  message,
  fields,
  children = "Excluir",
}: {
  action: Action;
  id: string;
  message: string;
  /** Campos extras enviados junto com o id. */
  fields?: Record<string, string>;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const readOnly = useContext(ReadOnlyCtx);

  useEffect(() => {
    if (state.error) window.alert(state.error);
  }, [state]);

  function onClick() {
    if (!window.confirm(message)) return;
    const data = new FormData();
    data.set("id", id);
    for (const [key, value] of Object.entries(fields ?? {})) data.set(key, value);
    startTransition(() => formAction(data));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || readOnly}
      className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ── campos ──

type Option = { value: string; label: string };
type Span = 1 | 2 | 3 | 4;

function spanClass(span?: Span) {
  return clsx(
    span === 2 && "sm:col-span-2",
    span === 3 && "sm:col-span-2 lg:col-span-3",
    span === 4 && "sm:col-span-2 lg:col-span-4",
  );
}

function useFieldError(name: string) {
  return useContext(FormCtx).state.fieldErrors?.[name];
}

function useReadOnly() {
  return useContext(FormCtx).readOnly;
}

function FieldShell({
  label, name, error, hint, required, span, children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  span?: Span;
  children: ReactNode;
}) {
  return (
    <div className={spanClass(span)}>
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type BaseProps = {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  span?: Span;
  disabled?: boolean;
};

export function TextField({
  name, label, required, hint, span, disabled,
  defaultValue, type = "text", placeholder, inputMode, maxLength, min, max, step, autoComplete,
  value, onChange,
}: BaseProps & {
  defaultValue?: string | number | null;
  /** Modo controlado (opcional). */
  value?: string;
  onChange?: (value: string) => void;
  type?: "text" | "email" | "date" | "time" | "month" | "number" | "password" | "tel";
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoComplete?: string;
}) {
  const error = useFieldError(name);
  const ro = useReadOnly();
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required} span={span}>
      <input
        id={name}
        name={name}
        type={type}
        {...(value !== undefined
          ? { value, onChange: (e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue == null ? "" : String(defaultValue) })}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        autoComplete={autoComplete}
        disabled={disabled || ro}
        aria-invalid={error ? true : undefined}
        className="input"
      />
    </FieldShell>
  );
}

const MASKS = {
  cpf: (v: string) =>
    v.replace(/\D/g, "").slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"),
  phone: (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  },
  cep: (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"),
} as const;

export function MaskedField({
  name, label, required, hint, span, disabled, defaultValue, mask,
}: BaseProps & { defaultValue?: string | null; mask: keyof typeof MASKS }) {
  const error = useFieldError(name);
  const ro = useReadOnly();
  const [text, setText] = useState(() => MASKS[mask](defaultValue ?? ""));
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required} span={span}>
      <input
        id={name}
        name={name}
        value={text}
        onChange={(e) => setText(MASKS[mask](e.target.value))}
        inputMode="numeric"
        disabled={disabled || ro}
        aria-invalid={error ? true : undefined}
        className="input"
      />
    </FieldShell>
  );
}

export function SelectField({
  name, label, required, hint, span, disabled, options, defaultValue, placeholder = "Selecione…", allowEmpty = true,
  value, onChange,
}: BaseProps & {
  options: Option[];
  defaultValue?: string | null;
  /** Modo controlado (opcional). */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const error = useFieldError(name);
  const ro = useReadOnly();
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required} span={span}>
      <select
        id={name}
        name={name}
        {...(value !== undefined
          ? { value, onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
        disabled={disabled || ro}
        aria-invalid={error ? true : undefined}
        className="input"
      >
        {allowEmpty && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

const OTHER = "__other";

/**
 * Lista de opções com saída para texto livre: escolhe-se uma opção ou "Outro (digitar)…".
 * Envia um único valor com o `name` informado.
 */
export function ComboField({
  name, label, required, hint, span, disabled, options, defaultValue, placeholder = "Selecione…", otherLabel = "Outro (digitar)…",
}: BaseProps & { options: string[]; defaultValue?: string | null; placeholder?: string; otherLabel?: string }) {
  const error = useFieldError(name);
  const ro = useReadOnly();
  const initial = defaultValue ?? "";
  const known = options.includes(initial);
  const [other, setOther] = useState(!!initial && !known);
  const [picked, setPicked] = useState(known ? initial : "");
  const [text, setText] = useState(!!initial && !known ? initial : "");
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required} span={span}>
      <input type="hidden" name={name} value={other ? text : picked} />
      <select
        id={name}
        value={other ? OTHER : picked}
        onChange={(e) => {
          if (e.target.value === OTHER) setOther(true);
          else {
            setOther(false);
            setPicked(e.target.value);
          }
        }}
        disabled={disabled || ro}
        aria-invalid={error ? true : undefined}
        className="input"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value={OTHER}>{otherLabel}</option>
      </select>
      {other && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite aqui"
          aria-label={label}
          disabled={disabled || ro}
          className="input mt-2"
        />
      )}
    </FieldShell>
  );
}

export function TextareaField({
  name, label, required, hint, span = 4, disabled, defaultValue, rows = 3,
}: BaseProps & { defaultValue?: string | null; rows?: number }) {
  const error = useFieldError(name);
  const ro = useReadOnly();
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required} span={span}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        disabled={disabled || ro}
        aria-invalid={error ? true : undefined}
        className="input resize-y"
      />
    </FieldShell>
  );
}

const PALETTE = [
  { value: "#2f8f68", name: "Verde" },
  { value: "#65a30d", name: "Lima" },
  { value: "#0d9488", name: "Turquesa" },
  { value: "#0891b2", name: "Ciano" },
  { value: "#3b82f6", name: "Azul" },
  { value: "#6366f1", name: "Índigo" },
  { value: "#8b5cf6", name: "Violeta" },
  { value: "#db2777", name: "Rosa" },
  { value: "#e11d48", name: "Vermelho" },
  { value: "#f97316", name: "Laranja" },
  { value: "#d97706", name: "Âmbar" },
  { value: "#64748b", name: "Cinza" },
];

/** Seletor de cor com paleta pronta (um clique) e opção de cor personalizada. */
export function ColorField({ name, label, defaultValue = PALETTE[0].value, span }: { name: string; label: string; defaultValue?: string; span?: Span }) {
  const [color, setColor] = useState(defaultValue);
  const ro = useReadOnly();
  const inPalette = PALETTE.some((c) => c.value.toLowerCase() === color.toLowerCase());
  return (
    <div className={spanClass(span)}>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
        {PALETTE.map((c) => {
          const selected = c.value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.name}
              disabled={ro}
              title={c.name}
              onClick={() => setColor(c.value)}
              className={clsx(
                "size-8 rounded-full ring-offset-2 transition",
                selected ? "ring-2 ring-ink" : "hover:scale-110",
              )}
              style={{ background: c.value }}
            />
          );
        })}
        <label
          className={clsx(
            "relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-muted text-xs text-muted ring-offset-2",
            !inPalette && "ring-2 ring-ink",
          )}
          title="Cor personalizada"
          style={!inPalette ? { background: color, borderStyle: "solid", borderColor: color } : undefined}
        >
          {inPalette && "+"}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Cor personalizada"
          />
        </label>
      </div>
    </div>
  );
}

/** Campo de valor sem rótulo, para células de tabela (ex.: tabela de preços). */
export function PriceInput({ name, defaultValue, placeholder = "—" }: { name: string; defaultValue?: string; placeholder?: string }) {
  const error = useFieldError(name);
  const ro = useReadOnly();
  return (
    <input
      name={name}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      inputMode="decimal"
      aria-label="Preço"
      disabled={ro}
      aria-invalid={error ? true : undefined}
      className="input ml-auto w-32 text-right tabular-nums"
    />
  );
}

/** Seleção de arquivo(s) para envio junto com o formulário. */
export function FileField({
  name, label, accept, multiple, hint, span, required,
}: { name: string; label: string; accept?: string; multiple?: boolean; hint?: string; span?: Span; required?: boolean }) {
  const error = useFieldError(name);
  const ro = useReadOnly();
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required} span={span}>
      <input
        id={name}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={ro}
        className="block w-full rounded-lg border border-line bg-surface text-sm text-muted file:mr-3 file:cursor-pointer file:border-0 file:bg-brand-600 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
      />
    </FieldShell>
  );
}

export function CheckboxField({
  name, label, defaultChecked, hint, span,
}: { name: string; label: string; defaultChecked?: boolean; hint?: string; span?: Span }) {
  const ro = useReadOnly();
  return (
    <div className={clsx("flex items-start gap-2 self-end pb-2", spanClass(span))}>
      <input
        id={name}
        name={name}
        type="checkbox"
        disabled={ro}
        defaultChecked={!!defaultChecked}
        className="mt-0.5 size-4 rounded border-line accent-brand-600"
      />
      <label htmlFor={name} className="text-sm">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

/** Grupo de caixas de seleção que enviam vários valores com o mesmo nome. */
export function CheckGroupField({
  name, label, options, defaultValues = [],
}: { name: string; label: string; options: string[]; defaultValues?: string[] }) {
  const ro = useReadOnly();
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="space-y-1.5">
        {options.map((o) => (
          <label key={o} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o}
              defaultChecked={defaultValues.includes(o)}
              disabled={ro}
              className="mt-0.5 size-4 shrink-0 rounded border-line accent-brand-600"
            />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FormGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>;
}
