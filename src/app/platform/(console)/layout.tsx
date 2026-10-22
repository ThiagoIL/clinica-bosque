import { LogOut, ShieldCheck } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { platformLogout } from "../actions";
import { PlatformNav } from "./platform-nav";

export default async function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-accent-500">
              <ShieldCheck className="size-4" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Administração do sistema</p>
              <p className="text-xs text-slate-400">Clínica Bosque</p>
            </div>
          </div>
          <PlatformNav />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-300 sm:inline">{admin.name}</span>
            <form action={platformLogout}>
              <button type="submit" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Sair" title="Sair">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
