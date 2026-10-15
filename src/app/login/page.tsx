import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-brand-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-brand-500 text-2xl font-bold">B</span>
          <h1 className="text-2xl">Clínica Bosque</h1>
          <p className="mt-1 text-sm text-brand-200/80">Acesse o sistema de gestão</p>
        </div>
        <div className="card p-6">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
