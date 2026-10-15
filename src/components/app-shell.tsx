"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  ArrowDownCircle, ArrowUpCircle, Boxes, CalendarDays, ClipboardList, Landmark, LayoutDashboard,
  LineChart, Menu, Package, Stethoscope, Tags, Truck, Users, Wallet, X,
} from "lucide-react";

const NAV = [
  {
    items: [{ href: "/", label: "Início", icon: LayoutDashboard }],
  },
  {
    title: "Atendimento",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/lancamentos", label: "Lançamentos", icon: ClipboardList },
      { href: "/pacientes", label: "Pacientes", icon: Users },
      { href: "/profissionais", label: "Profissionais", icon: Stethoscope },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/financeiro/receber", label: "Contas a receber", icon: ArrowDownCircle },
      { href: "/financeiro/pagar", label: "Contas a pagar", icon: ArrowUpCircle },
      { href: "/financeiro/extrato", label: "Extrato", icon: Wallet },
      { href: "/financeiro/fluxo", label: "Fluxo de caixa", icon: LineChart },
    ],
  },
  {
    title: "Estoque",
    items: [
      { href: "/estoque", label: "Itens e saldo", icon: Package },
      { href: "/estoque/movimentacoes", label: "Movimentações", icon: Boxes },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/servicos", label: "Serviços", icon: Tags },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
      { href: "/financeiro/contas", label: "Contas e categorias", icon: Landmark },
    ],
  },
];

export function AppShell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map((group, i) => (
        <div key={i}>
          {group.title && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-300/70">
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
                      ? "bg-white/12 font-medium text-white"
                      : "text-brand-100/80 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
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
    <div className="flex h-full flex-col bg-brand-900 text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-lg bg-brand-500 text-lg font-bold">B</span>
        <div className="leading-tight">
          <p className="font-semibold">Clínica Bosque</p>
          <p className="text-xs text-brand-200/70">Gestão da clínica</p>
        </div>
      </div>
      {nav}
      <div className="border-t border-white/10 p-4">{footer}</div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="btn btn-ghost -ml-2 p-2" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        <span className="font-semibold">Clínica Bosque</span>
        <span className="w-9" />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 rounded p-1 text-white/80 hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
