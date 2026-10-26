import type { ContractStatus } from "@/generated/prisma/enums";
import { addDays, dateOnlyToString, todayString } from "@/lib/dates";

export const EXPIRING_DAYS = 30;

export type ContractDisplay = {
  key: "ACTIVE" | "EXPIRING" | "EXPIRED" | "ENDED";
  label: string;
  tone: "green" | "amber" | "red" | "gray";
};

/**
 * Situação de um contrato para exibição:
 * Encerrado (ENDED) · Vencido (ativo com data final no passado) · Vence em N dias · Ativo.
 */
export function contractDisplay(c: { status: ContractStatus; endDate: Date | null }): ContractDisplay {
  if (c.status === "ENDED") return { key: "ENDED", label: "Encerrado", tone: "gray" };
  if (!c.endDate) return { key: "ACTIVE", label: "Ativo", tone: "green" };

  const today = todayString();
  const end = dateOnlyToString(c.endDate);
  if (end < today) return { key: "EXPIRED", label: "Vencido", tone: "red" };
  if (end <= addDays(today, EXPIRING_DAYS)) {
    const days = Math.round((c.endDate.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
    return { key: "EXPIRING", label: days === 0 ? "Vence hoje" : `Vence em ${days} dia${days === 1 ? "" : "s"}`, tone: "amber" };
  }
  return { key: "ACTIVE", label: "Ativo", tone: "green" };
}

// ── anexos ──

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB por envio
export const MAX_FILES_PER_UPLOAD = 5;

/** Extensões aceitas e o tipo de conteúdo servido (o tipo informado pelo navegador não é confiável). */
export const ALLOWED_FILES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain; charset=utf-8",
};

export const FILE_ACCEPT = Object.keys(ALLOWED_FILES).map((e) => `.${e}`).join(",");

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
