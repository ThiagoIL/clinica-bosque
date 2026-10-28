import "server-only";
import { ALLOWED_FILES, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, extensionOf, formatBytes } from "@/lib/contracts";
import { UserError } from "@/lib/form";

/** Valida os arquivos enviados no formulário (quantidade, tamanho total e tipo) e lê o conteúdo. */
export async function prepareFiles(formData: FormData, field = "files") {
  const files = formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES_PER_UPLOAD) {
    throw new UserError(`Envie até ${MAX_FILES_PER_UPLOAD} arquivos por vez.`);
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_FILE_BYTES) {
    throw new UserError(`O envio ultrapassa ${formatBytes(MAX_FILE_BYTES)} (enviado: ${formatBytes(total)}). Envie menos arquivos por vez.`);
  }

  const prepared = [];
  for (const file of files) {
    const ext = extensionOf(file.name);
    const mimeType = ALLOWED_FILES[ext];
    if (!mimeType) {
      throw new UserError(
        `Tipo de arquivo não permitido: “${file.name}”. Aceitos: ${Object.keys(ALLOWED_FILES).join(", ")}.`,
      );
    }
    // nome sem caminho e sem caracteres de controle
    const fileName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(-150);
    prepared.push({ fileName, mimeType, sizeBytes: file.size, data: Buffer.from(await file.arrayBuffer()) });
  }
  return prepared;
}
