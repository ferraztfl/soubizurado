"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createOfficialSimulationAction } from "@/modules/study/presentation/actions/simulation-actions";

import styles from "../oficial/oficial.module.css";

/**
 * Enters full screen first (it needs the click that triggered it) and then
 * builds the exam; the page change that follows is a client-side navigation, so
 * the full screen is kept and the exam opens in it.
 */
export function StartOfficialExam({ courseSlug, label = "Entrar em tela cheia e iniciar" }: Readonly<{ courseSlug: string; label?: string }>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);

    // Not awaited before the action: the request must happen inside the click.
    void document.documentElement.requestFullscreen?.().catch(() => undefined);

    startTransition(async () => {
      const result = await createOfficialSimulationAction(courseSlug);

      if (!result.ok) {
        setError(result.message);

        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => undefined);
        }

        return;
      }

      router.push(`/app/simulados/${result.id}`);
    });
  }

  return (
    <div className={styles.startBox}>
      <button type="button" className={styles.start} onClick={start} disabled={pending}>
        {pending ? "Montando a prova…" : label}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
