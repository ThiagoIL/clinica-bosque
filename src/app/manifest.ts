import type { MetadataRoute } from "next";

/** Manifesto do app instalável (PWA): ícone na tela inicial e abertura em tela cheia. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clínica Bosque",
    short_name: "Bosque",
    description: "Sistema de gestão da Clínica Bosque",
    lang: "pt-BR",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#e0e0e0", // cinza da logo: a tela de abertura se funde com o ícone
    theme_color: "#667b35", // verde da marca
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
