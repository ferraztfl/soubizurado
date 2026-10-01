import type { ReactNode } from "react";

/*
 * Menu icons (24x24 line icons, drawn here so no icon package is needed).
 * Keyed by the label of the sidebar item.
 */

const paths: Readonly<Record<string, ReactNode>> = {
  "Início": <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" />,
  "Explorar questões": (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  Estudar: <path d="M12 6.5c-1.8-1.3-4.3-1.8-7.5-1.5v12c3.2-.3 5.7.2 7.5 1.5 1.8-1.3 4.3-1.8 7.5-1.5V5c-3.2-.3-5.7.2-7.5 1.5ZM12 6.5v12" />,
  "Meus cursos": (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m10.5 9.5 4 2.5-4 2.5Z" />
    </>
  ),
  Desempenho: <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" />,
  Simulados: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 12.5l2 2 4-4.5M9 17.5h6" />
    </>
  ),
  "Missões": (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r=".8" />
    </>
  ),
  Ranking: <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4" />,
  Comunidade: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5M16 6.2a3 3 0 0 1 0 5.6M17.5 14.7c1.6.5 2.7 1.9 3 4.3" />
    </>
  ),
  Assinatura: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8Z" />,
  Loja: <path d="M5 8h14l-1 12H6L5 8ZM9 8V7a3 3 0 0 1 6 0v1" />,
  "Minhas compras": <path d="M6 3.5h12V21l-3-1.8-3 1.8-3-1.8L6 21V3.5ZM9.5 8h5M9.5 12h5" />,
  Perfil: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.6-3.6 3.2-5.5 7-5.5s6.4 1.9 7 5.5" />
    </>
  ),
  "Configurações": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </>
  ),
};

export function NavIcon({ label }: Readonly<{ label: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[label] ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
