"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { AppointmentStatus, CancelParty } from "@/generated/prisma/enums";
import { appointmentStatusLabel } from "@/lib/labels";
import { isTouchPhone, whatsappLink } from "@/lib/whatsapp";
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
  /** Quem informou a situação por último, ex.: "Maria em 28/10/2026 10:05". */
  statusBy: string | null;
  /** O usuário é o profissional do atendimento (ou administrador): pode abrir a tela de atendimento. */
  canAttend: boolean;
  /** Número e mensagem da consulta para o WhatsApp; null quando o paciente não tem telefone cadastrado. */
  whatsapp: { number: string; text: string } | null;
};

/** Logo simplificada do WhatsApp (balão com telefone). */
function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path strokeWidth="2" d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <g transform="translate(6.6 6.6) scale(0.45)">
        <path
          strokeWidth="3.5"
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        />
      </g>
    </svg>
  );
}

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
  // celular: o botão do WhatsApp abre o aplicativo em vez do WhatsApp Web
  const [phone, setPhone] = useState(false);

  function openAt() {
    const el = trigger.current;
    if (!el) return;
    setPhone(isTouchPhone());
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
                {info.statusBy && <span className="ml-2 text-xs text-muted">por {info.statusBy}</span>}
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

              {info.status !== "CANCELED" && (
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
                  {info.whatsapp ? (
                    <>
                      <span className="text-xs text-muted">Enviar a consulta ao paciente</span>
                      {/* celular: abre o aplicativo; computador: WhatsApp Web numa aba nomeada, reaproveitada nos envios seguintes */}
                      <a
                        href={whatsappLink(info.whatsapp.number, info.whatsapp.text, phone)}
                        target={phone ? undefined : "whatsapp-clinica"}
                        rel="noopener"
                        title={phone ? "Enviar a consulta ao paciente pelo WhatsApp" : "Enviar a consulta ao paciente pelo WhatsApp Web"}
                        aria-label="Enviar a consulta ao paciente pelo WhatsApp"
                        className="inline-flex size-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm hover:bg-[#1fb857]"
                      >
                        <WhatsappIcon className="size-6" />
                      </a>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted">Paciente sem telefone cadastrado</span>
                      <span
                        title="Cadastre um telefone no paciente para enviar pelo WhatsApp"
                        role="img"
                        aria-label="Paciente sem telefone cadastrado"
                        className="inline-flex size-11 items-center justify-center rounded-full bg-black/5 text-muted/60"
                      >
                        <WhatsappIcon className="size-6" />
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
