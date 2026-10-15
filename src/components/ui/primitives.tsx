import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-xs text-muted hover:text-brand-700">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm">{title}</h2>}
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={clsx(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  size,
  className,
  ...rest
}: Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

const TONES = {
  gray: "bg-stone-100 text-stone-700",
  green: "bg-brand-100 text-brand-800",
  blue: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  violet: "bg-violet-100 text-violet-800",
} as const;

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={clsx("badge", TONES[tone])}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "bad" | "warn";
  href?: string;
}) {
  const body = (
    <div className="card h-full p-4 transition-colors hover:border-brand-300">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={clsx(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-brand-700",
          tone === "bad" && "text-red-600",
          tone === "warn" && "text-amber-600",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Paginação por query string, preservando os demais filtros. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-muted" aria-label="Paginação">
      <span>
        Página {page} de {pages} · {total} registros
      </span>
      <div className="flex gap-2">
        {page > 1 && <LinkButton href={href(page - 1)} variant="outline" size="sm">Anterior</LinkButton>}
        {page < pages && <LinkButton href={href(page + 1)} variant="outline" size="sm">Próxima</LinkButton>}
      </div>
    </nav>
  );
}

export function FilterBar({ children, action }: { children: ReactNode; action: string }) {
  return (
    <form action={action} method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      {children}
      <button type="submit" className="btn btn-primary">Filtrar</button>
      <Link href={action} className="btn btn-ghost">Limpar</Link>
    </form>
  );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("min-w-36", className)}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/** Lê um parâmetro de busca como string única. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
