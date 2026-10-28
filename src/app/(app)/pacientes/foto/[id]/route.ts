import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasAccess, loadSnapshot } from "@/lib/access";

export const dynamic = "force-dynamic";

/** Foto do paciente (id = id do paciente). Exige sessão e acesso ao módulo Pacientes. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const snapshot = await loadSnapshot(user.id);
  if (snapshot.blocked || !hasAccess(snapshot, "PACIENTES")) return new Response("Sem permissão", { status: 403 });

  const { id } = await params;
  const photo = await db.patientPhoto.findUnique({ where: { patientId: id } });
  if (!photo) return new Response("Sem foto", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.data.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, max-age=300",
    },
  });
}
