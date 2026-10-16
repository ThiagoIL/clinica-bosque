import Link from "next/link";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      isAdmin={user.role === "ADMIN"}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Link href="/conta" className="min-w-0 leading-tight hover:underline" title="Minha conta e senha">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </Link>
          <form action={logout}>
            <button type="submit" className="rounded-lg p-2 text-muted hover:bg-black/5 hover:text-ink" aria-label="Sair" title="Sair">
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
