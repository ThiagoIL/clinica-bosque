import { buildPatientTemplate } from "@/lib/patient-import";

/** Planilha modelo para importar pacientes. O proxy já exige login e acesso ao módulo Pacientes neste caminho. */
export async function GET() {
  const file = await buildPatientTemplate();
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-pacientes.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
