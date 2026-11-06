"use client";

import { createContext, useContext, type ReactNode } from "react";

export type WhatsappTemplate = { id: string; name: string; body: string };
type Value = { templates: WhatsappTemplate[]; defaultId: string | null };

const Ctx = createContext<Value>({ templates: [], defaultId: null });

/**
 * Modelos de mensagem ativos, entregues uma vez só para a agenda inteira (cada atendimento da tela
 * usa os mesmos modelos, então não faz sentido repeti-los em cada um).
 */
export function WhatsappTemplatesProvider({ value, children }: { value: Value; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWhatsappTemplates = () => useContext(Ctx);
