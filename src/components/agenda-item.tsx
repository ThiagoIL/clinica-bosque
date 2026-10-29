"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { AppointmentStatus, CancelParty } from "@/generated/prisma/enums";
import { appointmentStatusLabel } from "@/lib/labels";
import { appointmentTone } from "@/lib/status";
import { Badge, LinkButton } from "@/components/ui/primitives";
import { AppointmentActions } from "@/components/appointment-actions";
import Link from "next/link";

export type AgendaItemInfo = {
  id: string;
  patientId: string;
  patientName: string;
  /** Dia e horário já formatados, ex.: "28/10/2026 10:00–10:50". */
  when: string;
  serviceName: string;
  professionalName: string;
  status: AppointmentStatus;
  canceledBy: CancelParty | null;
  startsAt: Date;
  engagement: { id: string; number: number } | null;
  hasEvolution: boolean;
  /** O usuário é o profissional do atendimento (ou administrador): pode abrir a tela de atendimento. */
  canAttend: boolean;
};

const WIDTH = 352; // 22rem

/**
 * Atendimento na agenda: ao clicar no nome do paciente abre uma janelinha em cima dele, com a situação
 * (confirmar, presente, ausente, cancelou), reagendamento e atalhos para o atendimento e o paciente.
 */
export function AgendaItem({
  info, className, style, title, defaultOpen, children,
}: {
  info: AgendaItemInfo;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** Abre sozinho (link vindo do painel inicial). */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  function openAt() {
    const el = trigger.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - WIDTH - 8));
    // a janelinha cobre o próprio atendimento; sobe um pouco se faltar espaço embaixo
    const room = window.innerHeight - rect.top;
    const top = rect.top + window.scrollY - (room < 460 ? Math.min(460 - room, rect.top - 8) : 0);
    setPos({ left, top });
  }

  useEffect(() => {
    if (!defaultOpen) return;
    trigger.current?.scrollIntoView({ block: "center" });
    openAt();
  }, [defaultOpen]);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pos]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => (pos ? setPos(null) : openAt())}
        aria-haspopup="dialog"
        aria-expanded={!!pos}
        className={className}
        style={style}
        title={title}
      >
        {children}
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPos(null)} aria-hidden />
            <div
              role="dialog"
              aria-label={`Atendimento de ${info.patientName}`}
              className="absolute z-50 rounded-xl border border-line bg-surface p-4 text-left shadow-xl"
              style={{ left: pos.left, top: pos.top, width: WIDTH, maxWidth: "calc(100vw - 16px)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{info.patientName}</p>
                  <p className="text-xs text-muted">{info.when}</p>
                  <p className="text-xs text-muted">{info.serviceName} · {info.professionalName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPos(null)}
                  aria-label="Fechar"
                  className="-mr-1 -mt-1 rounded p-1 text-muted hover:bg-black/5 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-2">
                <Badge tone={appointmentTone(info.status)}>{appointmentStatusLabel(info.status, info.canceledBy)}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {info.canAttend && (
                  <LinkButton href={`/atendimento/${info.id}`} size="sm">
                    {info.hasEvolution ? "Atendimento (evolução registrada)" : "Ir para o atendimento"}
                  </LinkButton>
                )}
                <LinkButton href={`/pacientes/${info.patientId}`} variant="outline" size="sm">Ir para o paciente</LinkButton>
                {info.engagement && (
                  <Link href={`/lancamentos/${info.engagement.id}`} className="text-xs text-brand-700 hover:underline">
                    Lançamento #{info.engagement.number}
                  </Link>
                )}
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <AppointmentActions appointment={{ id: info.id, status: info.status, startsAt: info.startsAt }} />
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
