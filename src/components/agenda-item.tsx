"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { AppointmentStatus, CancelParty } from "@/generated/prisma/enums";
import { appointmentStatusLabel } from "@/lib/labels";
import { DEFAULT_TEMPLATE_BODY, isTouchPhone, renderTemplate, whatsappLink, type MessageVars } from "@/lib/whatsapp";
import { useWhatsappTemplates } from "@/components/whatsapp-templates";
import { AbaBadge } from "@/components/aba-badge";
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
  /** Atendimento de lançamento de paciente ABA (mostra o cérebro). */
  aba: boolean;
  /** Quem informou a situação por último, ex.: "Maria em 28/10/2026 10:05". */
  statusBy: string | null;
  /** O usuário é o profissional do atendimento (ou administrador): pode abrir a tela de atendimento. */
  canAttend: boolean;
  /** Número do paciente e valores das variáveis da mensagem; null quando ele não tem telefone cadastrado. */
  whatsapp: { number: string; vars: MessageVars } | null;
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

/**
 * Rodapé do card: escolha do modelo de mensagem (Cadastros > Mensagens do WhatsApp) e o botão que abre a conversa
 * com o paciente. Celular: abre o aplicativo; computador: WhatsApp Web numa aba nomeada, reaproveitada nos envios seguintes.
 */
function WhatsappSend({ whatsapp, phone }: { whatsapp: AgendaItemInfo["whatsapp"]; phone: boolean }) {
  const { templates, defaultId } = useWhatsappTemplates();
  const [chosen, setChosen] = useState<string | null>(null);
  const current = templates.find((t) => t.id === (chosen ?? defaultId)) ?? templates[0] ?? null;

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
      {whatsapp ? (
        <>
          {templates.length > 1 ? (
            <select
              value={current?.id ?? ""}
              onChange={(e) => setChosen(e.target.value)}
              aria-label="Modelo da mensagem"
              title="Modelo da mensagem"
              className="input min-w-0 flex-1 py-1.5 text-sm"
            >
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <span className="flex-1 text-right text-xs text-muted">{current?.name ?? "Enviar a consulta ao paciente"}</span>
          )}
          <a
            href={whatsappLink(whatsapp.number, renderTemplate(current?.body ?? DEFAULT_TEMPLATE_BODY, whatsapp.vars), phone)}
            target={phone ? undefined : "whatsapp-clinica"}
            rel="noopener"
            title={phone ? "Enviar pelo WhatsApp" : "Enviar pelo WhatsApp Web"}
            aria-label="Enviar a mensagem ao paciente pelo WhatsApp"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm hover:bg-[#1fb857]"
          >
            <WhatsappIcon className="size-6" />
          </a>
        </>
      ) : (
        <>
          <span className="flex-1 text-right text-xs text-muted">Paciente sem telefone cadastrado</span>
          <span
            title="Cadastre um telefone no paciente para enviar pelo WhatsApp"
            role="img"
            aria-label="Paciente sem telefone cadastrado"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-black/5 text-muted/60"
          >
            <WhatsappIcon className="size-6" />
          </span>
        </>
      )}
    </div>
  );
}

const WIDTH = 352; // 22rem

/**
 * Atendimento na agenda: ao clicar no nome do paciente abre uma janela no centro da tela, com a situação
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
  const [open, setOpen] = useState(false);
  // celular: o botão do WhatsApp abre o aplicativo em vez do WhatsApp Web
  const [phone, setPhone] = useState(false);

  function show() {
    setPhone(isTouchPhone());
    setOpen(true);
  }

  useEffect(() => {
    if (defaultOpen) show();
  }, [defaultOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
        style={style}
        title={title}
      >
        {children}
      </button>
      {open &&
        createPortal(
          // modal centralizado na tela: o fundo escurece e, se a tela for baixa, o card rola por dentro
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Atendimento de ${info.patientName}`}
              className="relative max-h-full overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-4 text-left shadow-xl"
              style={{ width: WIDTH }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{info.patientName}</p>
                  <p className="text-xs text-muted">{info.when}</p>
                  <p className="text-xs text-muted">{info.serviceName} · {info.professionalName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                  className="-mr-1 -mt-1 rounded p-1 text-muted hover:bg-black/5 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {info.aba && <AbaBadge />}
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

              <WhatsappSend whatsapp={info.whatsapp} phone={phone} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
