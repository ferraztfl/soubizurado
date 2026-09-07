import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Sou Bizurado",
    template: "%s | Sou Bizurado",
  },
  description:
    "Plataforma de preparação para concursos públicos com banco de questões e acompanhamento de desempenho.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
