"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestSyllabusPdfAction, type SyllabusPdfState } from "@/modules/leads/presentation/lead-actions";

import styles from "./syllabus-page.module.css";

const INITIAL: SyllabusPdfState = { status: "idle", message: null, downloadUrl: null };

/** "Baixe em PDF": name, e-mail and WhatsApp unlock the printable edital verticalizado. */
export function SyllabusPdfForm({ syllabusId, title }: Readonly<{ syllabusId: string; title: string }>) {
  const [state, action, pending] = useActionState(requestSyllabusPdfAction, INITIAL);

  if (state.status === "ok" && state.downloadUrl) {
    return (
      <section id="pdf" className={styles.pdfCard} aria-live="polite">
        <h2>Seu PDF está pronto</h2>
        <p>Edital verticalizado de {title}, com capa, resumo da prova e checklist para imprimir.</p>
        <a href={state.downloadUrl} className={styles.pdfButton} download>
          Baixar o PDF
        </a>
      </section>
    );
  }

  return (
    <section id="pdf" className={styles.pdfCard}>
      <h2>Baixe este edital verticalizado em PDF — grátis</h2>
      <p>
        Versão para imprimir, com o resumo da prova e uma tabela por matéria para marcar teoria, questões e duas revisões de cada
        assunto.
      </p>
      <form action={action} className={styles.pdfForm}>
        <input type="hidden" name="syllabusId" value={syllabusId} />
        {/* Honeypot: hidden from people, filled by bots. */}
        <input type="text" name="empresa" tabIndex={-1} autoComplete="off" className={styles.honeypot} aria-hidden="true" />
        <label>
          <span>Nome e sobrenome</span>
          <input name="name" required minLength={5} maxLength={120} autoComplete="name" />
        </label>
        <label>
          <span>E-mail</span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" />
        </label>
        <label>
          <span>WhatsApp com DDD</span>
          <input name="whatsapp" type="tel" required maxLength={20} autoComplete="tel-national" placeholder="(81) 99999-0000" inputMode="tel" />
        </label>
        <label className={styles.pdfCheck}>
          <input type="checkbox" name="privacy" required />
          <span>
            Li a <Link href="/privacidade" target="_blank">Política de privacidade</Link> e concordo com o uso desses dados para me enviar o material.
          </span>
        </label>
        <label className={styles.pdfCheck}>
          <input type="checkbox" name="marketing" />
          <span>Quero receber novidades de concursos e ofertas do Sou Bizurado por e-mail e WhatsApp (opcional).</span>
        </label>
        <button type="submit" className={styles.pdfButton} disabled={pending}>
          {pending ? "Preparando…" : "Quero o PDF"}
        </button>
        {state.status === "error" && state.message ? (
          <p className={styles.pdfError} role="alert">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
