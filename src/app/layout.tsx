import type {
  Metadata,
  Viewport,
} from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  // Absolute canonical / Open Graph URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Sou Bizurado",
    template: "%s | Sou Bizurado",
  },
  description:
    "Plataforma de preparação para concursos públicos com banco de questões e acompanhamento de desempenho.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111113",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
