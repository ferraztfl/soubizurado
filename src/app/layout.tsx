import type {
  Metadata,
  Viewport,
} from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
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

// Self-hosted by next/font (no request to Google at runtime). Inter for text,
// Plus Jakarta Sans for headings.
const bodyFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-body" });
const headingFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="pt-BR" className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
