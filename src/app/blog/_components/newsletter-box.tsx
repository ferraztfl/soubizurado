"use client";

import Link from "next/link";
import { useActionState } from "react";

import { subscribeNewsletterAction, type NewsletterState } from "@/modules/blog/presentation/newsletter-actions";

import styles from "../portal.module.css";

const initial: NewsletterState = { status: "idle", message: null };

export function NewsletterBox() {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, initial);

  return (
    <section className={styles.newsletter} aria-label="Newsletter">
      <svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true" className={styles.newsletterIcon}>
        <rect x="4" y="10" width="56" height="34" rx="6" fill="currentColor" opacity="0.15" />
        <path d="M4 16l28 18 28-18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="52" cy="10" r="8" fill="var(--sb-brand)" />
      </svg>
      <strong>Quer receber novidades sobre concursos?</strong>
      <p>Editais, datas de prova e dicas de estudo direto no seu e-mail.</p>

      {state.status === "ok" ? (
        <p className={styles.newsletterOk} role="status">
          {state.message}
        </p>
      ) : (
        <form action={action} className={styles.newsletterForm}>
          <label className={styles.srOnly} htmlFor="newsletter-email">
            Seu e-mail
          </label>
          <input id="newsletter-email" name="email" type="email" required maxLength={254} placeholder="seu@email.com" autoComplete="email" />
          <label className={styles.consent}>
            <input type="checkbox" name="consent" required />
            <span>
              Autorizo o envio de e-mails do Sou Bizurado (dá para sair quando quiser). <Link href="/privacidade">Privacidade</Link>
            </span>
          </label>
          {state.status === "error" ? (
            <p className={styles.newsletterError} role="alert">
              {state.message}
            </p>
          ) : null}
          <button type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Quero receber"}
          </button>
        </form>
      )}
    </section>
  );
}
