import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Sou Bizurado",
    template: "%s | Sou Bizurado",
  },
  description:
    "Plataforma de preparação para concursos públicos com banco de questões e acompanhamento de desempenho.",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}