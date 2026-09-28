/*
 * Simple line icons for editorials (own drawings, 24×24, currentColor).
 */

const PATHS: Readonly<Record<string, string>> = {
  badge: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zm0 5l1.2 2.5 2.8.4-2 2 .5 2.8L12 14.4 9.5 15.7l.5-2.8-2-2 2.8-.4L12 8z",
  chart: "M4 20h16M6 16v-4M10 16V8M14 16v-6M18 16V5",
  scales: "M12 4v16M7 20h10M5 8h14M5 8l-3 6a3 3 0 006 0L5 8zm14 0l-3 6a3 3 0 006 0l-3-6z",
  gavel: "M14 4l6 6M11 7l6 6M12.5 5.5l-6 6M9 14l-5 5M16 11.5l-4.5 4.5",
  cap: "M2 9l10-5 10 5-10 5L2 9zm4 2v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6",
  medal: "M8 3h8l-2 6h-4L8 3zm4 6a5 5 0 110 10 5 5 0 010-10zm0 3l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3L12 12z",
  health: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z",
  monitor: "M3 5h18v11H3V5zm6 15h6M12 16v4",
  briefcase: "M3 8h18v11H3V8zm6 0V5h6v3M3 13h18",
  bank: "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18",
  building: "M5 21V4h14v17M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2M3 21h18",
  pencil: "M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3",
  megaphone: "M3 10v4l3 1 2 5h2l-1-4 9 3V5L6 9H3v1zM18 9a3 3 0 010 6",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0012 3z",
  news: "M4 5h13v14H6a2 2 0 01-2-2V5zm13 4h3v8a2 2 0 01-2 2M7 9h7M7 12h7M7 15h4",
};

export function BlogIcon({ name, className }: Readonly<{ name: string | null | undefined; className?: string }>) {
  const path = PATHS[name ?? ""] ?? PATHS.news!;

  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
