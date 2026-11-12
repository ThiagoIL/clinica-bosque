"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import type { AppointmentStatus, CancelParty } from "@/generated/prisma/enums";
import { appointmentStatusLabel } from "@/lib/labels";
import { formatDate, localParts, weekdayShort } from "@/lib/dates";
import { moveAppointment } from "@/app/(app)/agenda/actions";
import { deleteEngagement } from "@/app/(app)/lancamentos/actions";
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
  endsAt: Date;
  engagement: { id: string; number: number; canceled: boolean } | null;
  /** Pode editar/excluir o lançamento deste atendimento (lápis e lixeira do card). */
  canEditEngagement: boolean;
  /** Pode arrastar/esticar: atendimento em aberto e usuário com permissão de alterar a agenda. */
  canMove: boolean;
  /** Tem atendimentos repetidos depois deste no mesmo lançamento (pergunta se a mudança vale para os próximos). */
  hasFollowing: boolean;
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

const SNAP = 15; // o arrastar encaixa de 15 em 15 minutos

type DragState = {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  /** Topo e altura do atendimento (px) em relação à coluna do dia, e a esquerda da coluna, quando o arrastar começou. */
  top: number;
  height: number;
  colLeft: number;
  moved: boolean;
  pointerId: number;
};
/** Onde o atendimento ficaria se soltasse agora: deslocamento visual e o dia/horário/duração resultantes. */
type Preview = { dx: number; dy: number; height: number | null; date: string; start: number; duration: number; x: number; y: number };
type Proposal = { date: string; time: string; duration: number };

const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`) : `${m} min`;
}

const dayLabel = (date: string) => `${weekdayShort(date)} ${formatDate(date).slice(0, 5)}`;

function describeSlot(date: string, startMinutes: number, duration: number) {
  return `${dayLabel(date)} · ${minutesToTime(startMinutes)}–${minutesToTime(startMinutes + duration)} (${durationLabel(duration)})`;
}

function describeChange(origin: { date: string; time: string; duration: number }, p: Proposal) {
  const parts: string[] = [];
  if (p.date !== origin.date || p.time !== origin.time) parts.push(`Novo horário: ${dayLabel(p.date)}, ${p.time}`);
  if (p.duration !== origin.duration) parts.push(`Nova duração: ${durationLabel(p.duration)}`);
  return parts.join(" · ");
}

/** Lixeira do card: exclui o lançamento inteiro (todos os atendimentos e cobranças), depois de confirmar. */
function EngagementDelete({ engagement, patientName }: { engagement: { id: string; number: number }; patientName: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      `Excluir o lançamento #${engagement.number} de ${patientName}?\n\nTodos os atendimentos e as cobranças dele serão removidos e não dá para desfazer. Para manter o histórico, use “Cancelar lançamento” na tela do lançamento.`,
    );
    if (!ok) return;
    const data = new FormData();
    data.set("id", engagement.id);
    startTransition(async () => {
      const result = await deleteEngagement({}, data);
      if (result?.error) window.alert(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="Excluir o lançamento"
      aria-label="Excluir o lançamento"
      className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}

/**
 * Atendimento na agenda: ao clicar no nome do paciente abre uma janela no centro da tela, com a situação
 * (confirmar, presente, ausente, cancelou), reagendamento e atalhos para o atendimento e o paciente.
 */
export function AgendaItem({
  info, className, style, title, defaultOpen, drag, children,
}: {
  info: AgendaItemInfo;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** Abre sozinho (link vindo do painel inicial). */
  defaultOpen?: boolean;
  /** Medidas da grade de horários: liga o arrastar e esticar (só nas visões de dia e semana). */
  drag?: { startHour: number; endHour: number; hourHeight: number };
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

  // ── arrastar (mudar de dia/horário) e esticar (mudar a duração), como no Google Agenda ──
  const origin = useMemo(() => {
    const parts = localParts(info.startsAt);
    return {
      date: parts.date,
      time: parts.time,
      minutes: Number(parts.time.slice(0, 2)) * 60 + Number(parts.time.slice(3)),
      duration: Math.round((info.endsAt.getTime() - info.startsAt.getTime()) / 60_000),
    };
  }, [info.startsAt, info.endsAt]);

  const dragRef = useRef<DragState | null>(null);
  const latest = useRef<Preview | null>(null);
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [ask, setAsk] = useState<Proposal | null>(null); // mudança aguardando "só este" ou "este e os próximos"
  const [moving, startMove] = useTransition();

  // o servidor devolveu o atendimento já no novo lugar: some a prévia
  useEffect(() => {
    latest.current = null;
    setPreview(null);
  }, [info.startsAt.getTime(), info.endsAt.getTime()]);

  function compute(clientX: number, clientY: number, d: DragState): Preview | null {
    if (!drag) return null;
    const hh = drag.hourHeight;
    const gridMinutes = (drag.endHour - drag.startHour) * 60;
    const startOffset = origin.minutes - drag.startHour * 60; // minutos desde o topo da grade
    if (d.mode === "resize") {
      const bottomPx = d.top + d.height + (clientY - d.startY);
      let duration = Math.round((((bottomPx - d.top) / hh) * 60) / SNAP) * SNAP;
      duration = Math.max(SNAP, Math.min(duration, gridMinutes - startOffset));
      return { dx: 0, dy: 0, height: Math.max((duration / 60) * hh, 14), date: origin.date, start: startOffset, duration, x: clientX, y: clientY };
    }
    const columns = Array.from(document.querySelectorAll<HTMLElement>("[data-agenda-day]"));
    const distance = (c: HTMLElement) => {
      const r = c.getBoundingClientRect();
      return clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
    };
    const target = columns.reduce<HTMLElement | null>((best, c) => (!best || distance(c) < distance(best) ? c : best), null);
    if (!target) return null;
    const topPx = d.top + (clientY - d.startY);
    let start = Math.round(((topPx / hh) * 60) / SNAP) * SNAP;
    start = Math.max(0, Math.min(start, gridMinutes - origin.duration));
    return {
      dx: target.getBoundingClientRect().left - d.colLeft,
      dy: (start / 60) * hh - d.top,
      height: null,
      date: target.dataset.agendaDay ?? origin.date,
      start,
      duration: origin.duration,
      x: clientX,
      y: clientY,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag || !info.canMove || moving || e.button !== 0 || e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const column = el.parentElement;
    if (!column?.dataset.agendaDay) return;
    const rect = el.getBoundingClientRect();
    const colRect = column.getBoundingClientRect();
    dragRef.current = {
      mode: e.clientY > rect.bottom - 8 && rect.height >= 24 ? "resize" : "move",
      startX: e.clientX, startY: e.clientY, top: rect.top - colRect.top, height: rect.height, colLeft: colRect.left,
      moved: false, pointerId: e.pointerId,
    };
    try {
      el.setPointerCapture(e.pointerId); // continua recebendo o movimento mesmo fora do bloco
    } catch {
      // sem captura o arrastar ainda funciona enquanto o mouse estiver sobre o bloco
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) {
      // sem arrastar: o cursor avisa que a borda de baixo estica
      if (drag && info.canMove && e.pointerType === "mouse") {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.cursor = e.clientY > rect.bottom - 8 && rect.height >= 24 ? "ns-resize" : "grab";
      }
      return;
    }
    if (e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
    d.moved = true;
    const next = compute(e.clientX, e.clientY, d);
    latest.current = next;
    setPreview(next);
  }

  function finishDrag(e: React.PointerEvent<HTMLButtonElement>, cancel: boolean) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.moved) return; // foi só um clique: abre o card
    suppressClick.current = true; // o "click" que o navegador dispara ao soltar não deve abrir o card
    setTimeout(() => (suppressClick.current = false), 0); // e, se ele não vier, a trava não fica presa
    const p = latest.current;
    if (cancel || !p || !drag) {
      latest.current = null;
      setPreview(null);
      return;
    }
    const proposal: Proposal = { date: p.date, time: minutesToTime(drag.startHour * 60 + p.start), duration: p.duration };
    if (proposal.date === origin.date && proposal.time === origin.time && proposal.duration === origin.duration) {
      latest.current = null;
      setPreview(null); // voltou ao mesmo lugar
    } else if (info.hasFollowing) {
      setAsk(proposal);
    } else {
      apply(proposal, "one");
    }
  }

  function apply(proposal: Proposal, scope: "one" | "series") {
    setAsk(null);
    const data = new FormData();
    data.set("id", info.id);
    data.set("date", proposal.date);
    data.set("time", proposal.time);
    data.set("duration", String(proposal.duration));
    data.set("scope", scope);
    startMove(async () => {
      const result = await moveAppointment({}, data);
      if (result?.error) {
        window.alert(result.error);
        latest.current = null;
        setPreview(null); // volta ao lugar de antes
      }
    });
  }

  function cancelAsk() {
    setAsk(null);
    latest.current = null;
    setPreview(null);
  }

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancelAsk();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

  const dragging = dragRef.current?.moved === true;
  const itemStyle: CSSProperties | undefined = preview
    ? {
        ...style,
        transform: `translate(${preview.dx}px, ${preview.dy}px)`,
        ...(preview.height ? { height: preview.height } : {}),
        zIndex: 40,
        transition: "none",
        opacity: moving ? 0.7 : 0.92,
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
        cursor: moving ? "progress" : "grabbing",
        userSelect: "none",
      }
    : style;
  const previewBadge = preview && dragging && drag ? describeSlot(preview.date, drag.startHour * 60 + preview.start, preview.duration) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false; // o clique que termina um arrastar não abre o card
            return;
          }
          if (open) setOpen(false);
          else show();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finishDrag(e, false)}
        onPointerCancel={(e) => finishDrag(e, true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
        style={itemStyle}
        title={title}
      >
        {children}
      </button>

      {previewBadge &&
        preview &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[70] rounded-md bg-ink px-2 py-1 text-xs font-medium text-white shadow-lg"
            style={{ left: preview.x + 14, top: preview.y + 14 }}
          >
            {previewBadge}
          </div>,
          document.body,
        )}

      {ask &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={cancelAsk} aria-hidden />
            <div role="alertdialog" aria-modal="true" aria-label="Aplicar a mudança" className="relative w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl">
              <p className="text-sm font-semibold">Aplicar a mudança em quais atendimentos?</p>
              <p className="mt-1 text-sm text-muted">{info.patientName} tem atendimentos repetidos neste lançamento.</p>
              <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm">{describeChange(origin, ask)}</p>
              <div className="mt-4 flex flex-col gap-2">
                <button type="button" className="btn btn-primary justify-center" onClick={() => apply(ask, "one")}>
                  Apenas este atendimento
                </button>
                <button type="button" className="btn btn-outline justify-center" onClick={() => apply(ask, "series")}>
                  Este e os próximos atendimentos
                </button>
                <button type="button" className="btn btn-ghost justify-center" onClick={cancelAsk}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

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
                <div className="-mr-1 -mt-1 flex shrink-0 items-center">
                  {info.engagement && info.canEditEngagement && (
                    <>
                      {!info.engagement.canceled && (
                        <Link
                          href={`/lancamentos/${info.engagement.id}/editar`}
                          title="Editar o lançamento" aria-label="Editar o lançamento"
                          className="rounded p-1.5 text-muted hover:bg-black/5 hover:text-ink"
                        >
                          <Pencil className="size-4" />
                        </Link>
                      )}
                      <EngagementDelete engagement={info.engagement} patientName={info.patientName} />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                    className="rounded p-1.5 text-muted hover:bg-black/5 hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </div>
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
