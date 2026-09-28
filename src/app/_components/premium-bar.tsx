"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./premium-bar.module.css";

const STORAGE_KEY = "sb_premium_bar_hidden_until";
const HIDE_DAYS = 7;

/** Fixed bottom bar inviting to Premium; closing it hides it for a week (this browser only). */
export function PremiumBar({ price, perDay }: Readonly<{ price: string; perDay: string }>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hiddenUntil = 0;
    try {
      hiddenUntil = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
    } catch {
      // Storage blocked: just show the bar.
    }
    const timer = window.setTimeout(() => setVisible(Date.now() > hiddenUntil), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  function close() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now() + HIDE_DAYS * 86_400_000));
    } catch {
      // Ignore: the bar simply comes back next time.
    }
  }

  return (
    <aside className={styles.bar} aria-label="Assinatura Premium">
      <span className={styles.crown} aria-hidden="true">
        ★
      </span>
      <p>
        <strong>
          Premium por {price}/mês — só {perDay} por dia.
        </strong>
        <span>Questões e simulados ilimitados, revisão dos erros e desempenho completo. Cancele quando quiser.</span>
      </p>
      <Link href="/assinatura" className={styles.cta}>
        Ver planos
      </Link>
      <button type="button" className={styles.close} onClick={close} aria-label="Fechar aviso">
        ×
      </button>
    </aside>
  );
}
