import { LockKeyhole } from "lucide-react";
import { loadSnapshot } from "@/lib/access";

export const metadata = { title: "Acesso suspenso" };
export const dynamic = "force-dynamic";

const DEFAULT_MESSAGE =
  "O acesso ao sistema está temporariamente suspenso. Entre em contato com o responsável pelo sistema para regularizar.";

export default async function BlockedPage() {
  const { blockMessage } = await loadSnapshot(null);
  return (
    <main className="grid min-h-screen place-items-center bg-sidebar px-4">
      <div className="w-full max-w-md text-center">
        <img src="/logo.jpg" alt="Clínica Bosque" width={128} height={128} className="mx-auto size-32" />
        <div className="card mt-2 p-8 shadow-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-100 text-accent-700">
            <LockKeyhole className="size-6" />
          </span>
          <h1 className="mt-4 text-xl">Acesso suspenso</h1>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{blockMessage?.trim() || DEFAULT_MESSAGE}</p>
          <a href="/" className="btn btn-outline mt-6">Tentar novamente</a>
        </div>
      </div>
    </main>
  );
}
