import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Clínica Bosque", template: "%s · Clínica Bosque" },
  description: "Sistema de gestão da Clínica Bosque",
  robots: { index: false, follow: false },
  // app instalável: no iPhone abre em tela cheia, com o nome curto sob o ícone
  appleWebApp: { capable: true, title: "Bosque", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // usa a tela toda; o conteúdo respeita a área segura (notch e barra inferior)
  themeColor: "#667b35",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
