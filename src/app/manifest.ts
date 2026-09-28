import type { MetadataRoute } from "next";

/** Installable web app (Android, iPhone and desktop): /aplicativo explains how to install. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sou Bizurado — Questões de concursos",
    short_name: "Sou Bizurado",
    description: "Questões de concursos públicos e do ENEM com gabarito, revisão dos erros, simulados e notícias.",
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#111113",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
