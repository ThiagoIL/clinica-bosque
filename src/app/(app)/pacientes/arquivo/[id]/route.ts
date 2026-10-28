import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasAccess, loadSnapshot } from "@/lib/access";

export const dynamic = "force-dynamic";

/** Download de documento do paciente. Exige sessão e acesso ao módulo Pacientes. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const snapshot = await loadSnapshot(user.id);
  if (snapshot.blocked || !hasAccess(snapshot, "PACIENTES")) return new Response("Sem permissão", { status: 403 });

  const { id } = await params;
  const file = await db.patientFile.findUnique({ where: { id } });
  if (!file) return new Response("Arquivo não encontrado", { status: 404 });

  const inlineAllowed = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
  const inline = inlineAllowed && new URL(request.url).searchParams.get("inline") === "1";

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      // arquivos enviados nunca executam nada no navegador
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, no-store",
    },
  });
}
