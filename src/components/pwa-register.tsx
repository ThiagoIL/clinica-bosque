"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do app instalável. Ele só guarda a página de "sem conexão":
 * nenhum dado do sistema (pacientes, financeiro…) fica salvo no celular.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // sem service worker o sistema funciona igual; só não mostra a tela de "sem conexão"
    });
  }, []);
  return null;
}
