"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  ArrowDownCircle, ArrowUpCircle, Boxes, CalendarDays, ClipboardList, Landmark, LayoutDashboard,
  HeartPulse, LineChart, Menu, Package, ReceiptText, ShieldCheck, Stethoscope, Tags, Truck, UserCog, Users, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import { ReadOnlyProvider } from "@/components/ui/form-kit";
import { moduleForPath, type Access, type Level, type ModuleKey } from "@/lib/modules";

type NavItem = { href: string; label: string; icon: LucideIcon; access?: Access };
type NavGroup = { title?: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { items: [{ href: "/", label: "Início", icon: LayoutDashboard }] },
  {
    title: "Atendimento",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays, access: "AGENDA" },
      { href: "/lancamentos", label: "Lançamentos", icon: ClipboardList, access: "LANCAMENTOS" },
      { href: "/pacientes", label: "Pacientes", icon: Users, access: "PACIENTES" },
      { href: "/profissionais", label: "Profissionais", icon: Stethoscope, access: "PROFISSIONAIS" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/financeiro/receber", label: "Contas a receber", icon: ArrowDownCircle, access: "FINANCEIRO" },
      { href: "/financeiro/pagar", label: "Contas a pagar", icon: ArrowUpCircle, access: "FINANCEIRO" },
      { href: "/financeiro/extrato", label: "Extrato", icon: Wallet, access: "FINANCEIRO" },
      { href: "/financeiro/fluxo", label: "Fluxo de caixa", icon: LineChart, access: "FINANCEIRO" },
    ],
  },
  {
    title: "Estoque",
    items: [
      { href: "/estoque", label: "Itens e saldo", icon: Package, access: "ESTOQUE" },
      { href: "/estoque/movimentacoes", label: "Movimentações", icon: Boxes, access: "ESTOQUE" },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/servicos", label: "Serviços", icon: Tags, access: "CADASTROS" },
      { href: "/planos", label: "Planos de saúde", icon: HeartPulse, access: "CADASTROS" },
      { href: "/precos", label: "Tabela de preços", icon: ReceiptText, access: "CADASTROS" },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck, access: "CADASTROS" },
      { href: "/financeiro/contas", label: "Contas e categorias", icon: Landmark, access: "FINANCEIRO" },
    ],
  },
  {
    title: "Administração",
    items: [
      { href: "/usuarios", label: "Usuários", icon: UserCog, access: "ADMIN" },
      { href: "/perfis", label: "Perfis de acesso", icon: ShieldCheck, access: "ADMIN" },
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

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group, i) => (
        <div key={i}>
          {group.title && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {group.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive(href)
                      ? "bg-white font-medium text-brand-800 shadow-xs ring-1 ring-black/5"
                      : "text-ink/75 hover:bg-black/5 hover:text-ink",
                  )}
                >
                  <Icon className={clsx("size-4 shrink-0", isActive(href) && "text-accent-600")} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
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
