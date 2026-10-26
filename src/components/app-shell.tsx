"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  ChevronRight, ClipboardList, Handshake, LayoutDashboard, Menu, Package, ShieldCheck, Stethoscope, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import { ReadOnlyProvider } from "@/components/ui/form-kit";
import { moduleForPath, type Access, type Level, type ModuleKey } from "@/lib/modules";

type NavItem = { href: string; label: string; access?: Access };
type NavGroup = { id: string; title: string; icon: LucideIcon; items: NavItem[] };

/** Menu agrupado por categoria: cada categoria abre e fecha, como no ERP. */
const NAV: NavGroup[] = [
  {
    id: "atendimento",
    title: "Atendimento",
    icon: Stethoscope,
    items: [
      { href: "/agenda", label: "Agenda", access: "AGENDA" },
      { href: "/lancamentos", label: "Lançamentos", access: "LANCAMENTOS" },
      { href: "/pacientes", label: "Pacientes", access: "PACIENTES" },
      { href: "/profissionais", label: "Profissionais", access: "PROFISSIONAIS" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: Wallet,
    items: [
      { href: "/financeiro/receber", label: "Contas a receber", access: "FINANCEIRO" },
      { href: "/financeiro/pagar", label: "Contas a pagar", access: "FINANCEIRO" },
      { href: "/financeiro/extrato", label: "Extrato", access: "FINANCEIRO" },
      { href: "/financeiro/fluxo", label: "Fluxo de caixa", access: "FINANCEIRO" },
      { href: "/financeiro/contas", label: "Contas e categorias", access: "FINANCEIRO" },
    ],
  },
  {
    id: "estoque",
    title: "Estoque",
    icon: Package,
    items: [
      { href: "/estoque", label: "Itens e saldo", access: "ESTOQUE" },
      { href: "/estoque/movimentacoes", label: "Movimentações", access: "ESTOQUE" },
    ],
  },
  {
    id: "cadastros",
    title: "Cadastros",
    icon: ClipboardList,
    items: [
      { href: "/servicos", label: "Serviços", access: "CADASTROS" },
      { href: "/planos", label: "Planos de saúde", access: "CADASTROS" },
      { href: "/precos", label: "Tabela de preços", access: "CADASTROS" },
    ],
  },
  {
    id: "colaboradores",
    title: "Colaboradores",
    icon: Handshake,
    items: [
      { href: "/colaboradores", label: "Colaboradores", access: "CONTRATOS" },
      { href: "/contratos", label: "Contratos", access: "CONTRATOS" },
    ],
  },
  {
    id: "administracao",
    title: "Administração",
    icon: ShieldCheck,
    items: [
      { href: "/usuarios", label: "Usuários", access: "ADMIN" },
      { href: "/perfis", label: "Perfis de acesso", access: "ADMIN" },
    ],
  },
];

/** Níveis de acesso do usuário logado, usados para montar o menu e o modo "somente consulta". */
export type ShellAccess = { isAdmin: boolean; levels: Record<ModuleKey, Level> };

export function AppShell({ children, footer, access }: { children: ReactNode; footer: ReactNode; access: ShellAccess }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const canSee = (item: NavItem) =>
    !item.access || (item.access === "ADMIN" ? access.isAdmin : access.levels[item.access] !== "NONE");
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter((g) => g.items.length > 0);

  // Perfil só de consulta no módulo da tela atual: formulários ficam desabilitados.
  const current = moduleForPath(pathname);
  const readOnly = !!current && current !== "ADMIN" && access.levels[current] === "VIEW";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  // Categorias abertas: a da tela atual abre sozinha; as demais o usuário abre e fecha.
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href)))?.id;
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup] : []);
  useEffect(() => {
    if (activeGroup) setOpenGroups((cur) => (cur.includes(activeGroup) ? cur : [...cur, activeGroup]));
  }, [activeGroup]);
  const toggle = (id: string) =>
    setOpenGroups((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]));

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      <Link
        href="/"
        onClick={() => setOpen(false)}
        className={clsx(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive("/") ? "bg-white font-medium text-brand-800 shadow-xs ring-1 ring-black/5" : "text-ink/80 hover:bg-black/5 hover:text-ink",
        )}
      >
        <LayoutDashboard className={clsx("size-4 shrink-0", isActive("/") && "text-accent-600")} />
        Início
      </Link>

      {groups.map((group) => {
        const expanded = openGroups.includes(group.id);
        const hasActive = group.id === activeGroup;
        const Icon = group.icon;
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-expanded={expanded}
              className={clsx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/5",
                hasActive ? "font-medium text-ink" : "text-ink/80",
              )}
            >
              <Icon className={clsx("size-4 shrink-0", hasActive && "text-accent-600")} />
              <span className="flex-1">{group.title}</span>
              <ChevronRight className={clsx("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-90")} />
            </button>
            {expanded && (
              <ul className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-black/10 pl-3">
                {group.items.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={clsx(
                        "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                        isActive(href)
                          ? "bg-white font-medium text-brand-800 shadow-xs ring-1 ring-black/5"
                          : "text-ink/70 hover:bg-black/5 hover:text-ink",
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-ink">
      <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3">
        {/* a logo tem o mesmo cinza do fundo da barra lateral e se funde com ela */}
        <img src="/logo.jpg" alt="Clínica Bosque" width={64} height={64} className="size-16 shrink-0" />
        <div className="leading-tight">
          <p className="font-semibold">Clínica Bosque</p>
          <p className="text-xs text-muted">Gestão da clínica</p>
        </div>
      </div>
      {nav}
      <div className="border-t border-black/10 p-4">{footer}</div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="btn btn-ghost -ml-2 p-2" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        <span className="flex items-center gap-2 font-semibold">
          <img src="/logo.jpg" alt="" width={32} height={32} className="size-8 rounded-full" />
          Clínica Bosque
        </span>
        <span className="w-9" />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 rounded p-1 text-muted hover:text-ink"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          {readOnly && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              Seu perfil tem acesso somente de <strong>consulta</strong> a este módulo: você pode ver as informações, mas não alterá-las.
            </p>
          )}
          <ReadOnlyProvider readOnly={readOnly}>{children}</ReadOnlyProvider>
        </div>
      </main>
    </div>
  );
}
