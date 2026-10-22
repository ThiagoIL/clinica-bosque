import { LogOut } from "lucide-react";
import { getPlatformBase, requirePlatformAdmin } from "@/lib/platform-auth";
import { platformLogout } from "../actions";
import { PlatformShell } from "./platform-shell";

export default async function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  const base = await getPlatformBase();
  return (
    <PlatformShell
      base={base}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{admin.name}</p>
            <p className="truncate text-xs text-slate-400">{admin.email}</p>
          </div>
          <form action={platformLogout}>
            <button type="submit" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Sair" title="Sair">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      }
    >
      {children}
    </PlatformShell>
  );
}
