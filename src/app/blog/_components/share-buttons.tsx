"use client";

import { useState } from "react";

import styles from "../portal.module.css";

type Target = Readonly<{ name: string; href: string; path: string }>;

function targets(url: string, title: string): Target[] {
  const link = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  return [
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      path: "M20 11.5A8.5 8.5 0 0 1 7.4 19l-3.9 1 1-3.8A8.5 8.5 0 1 1 20 11.5Z M9 8.5c.3 2.9 2.6 5.3 5.5 5.6l1-1.1 2 .9-.4 1.6c-3.8.4-8-3.8-7.6-7.6l1.6-.4.9 2Z",
    },
    { name: "Telegram", href: `https://t.me/share/url?url=${link}&text=${text}`, path: "M21 4 3 11l6 2 2 6 3-4 5 4 2-15Z M9 13l9-6" },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${link}`, path: "M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z" },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${link}&text=${text}`, path: "M4 4l16 16M20 4 4 20" },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}`, path: "M5 9v11M5 5v.5M10 20v-6a3 3 0 0 1 6 0v6M10 9v11" },
    { name: "E-mail", href: `mailto:?subject=${text}&body=${link}`, path: "M3 6h18v12H3z M3 6l9 7 9-7" },
  ];
}

function Icon({ path }: Readonly<{ path: string }>) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Round share buttons (copy link + networks); "rail" = vertical, sticky beside the text. */
export function ShareButtons({ url, title, layout }: Readonly<{ url: string; title: string; layout: "row" | "rail" }>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  }

  return (
    <div className={layout === "rail" ? styles.shareRail : styles.shareRow} aria-label="Compartilhar">
      {layout === "rail" ? <span className={styles.shareLabel}>Compartilhe</span> : null}
      <button type="button" onClick={copy} className={styles.shareButton} aria-label={copied ? "Link copiado" : "Copiar link"} title={copied ? "Link copiado!" : "Copiar link"}>
        {copied ? "✓" : <Icon path="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />}
      </button>
      {targets(url, title).map((target) => (
        <a
          key={target.name}
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.shareButton}
          aria-label={`Compartilhar no ${target.name}`}
          title={target.name}
        >
          <Icon path={target.path} />
        </a>
      ))}
    </div>
  );
}
