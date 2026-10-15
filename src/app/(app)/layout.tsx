import { LogOut } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-brand-200/70">{user.email}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded-lg p-2 text-brand-100/80 hover:bg-white/10 hover:text-white" aria-label="Sair" title="Sair">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
