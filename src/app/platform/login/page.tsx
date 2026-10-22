import { ShieldCheck } from "lucide-react";
import { PlatformLoginForm } from "./login-form";

export const metadata = { title: "Administração do sistema" };

export default function PlatformLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-accent-500">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-2xl">Administração do sistema</h1>
          <p className="mt-1 text-sm text-slate-300">Acesso restrito ao fornecedor</p>
        </div>
        <div className="card p-6">
          <PlatformLoginForm />
        </div>
      </div>
    </main>
  );
}
