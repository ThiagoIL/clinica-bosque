import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center">
          {/* o fundo da logo é o mesmo cinza da página, então ela aparece sem moldura */}
          <img src="/logo.jpg" alt="Clínica Bosque" width={176} height={176} className="mx-auto size-44" />
          <h1 className="-mt-2 text-2xl">Clínica Bosque</h1>
          <p className="mt-1 text-sm text-muted">Acesse o sistema de gestão</p>
        </div>
        <div className="card p-6 shadow-sm">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
