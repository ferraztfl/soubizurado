"use client";

import { useEffect, useState } from "react";

import styles from "./aplicativo.module.css";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  if (/Android/i.test(agent)) return "android";
  return "desktop";
}

/**
 * Installs the web app: uses the browser prompt when it offers one
 * (Chrome, Edge, Android) and shows the manual steps otherwise (iPhone).
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPlatform(detectPlatform());
      setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    }, 0);

    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  if (installed) {
    return <p className={styles.installed}>✓ O Sou Bizurado já está instalado neste aparelho.</p>;
  }

  if (prompt) {
    return (
      <button type="button" className={styles.installButton} onClick={install}>
        Instalar o Sou Bizurado
      </button>
    );
  }

  if (platform === "ios") {
    return (
      <ol className={styles.steps}>
        <li>Abra esta página no <strong>Safari</strong>.</li>
        <li>
          Toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima).
        </li>
        <li>
          Escolha <strong>Adicionar à Tela de Início</strong> e confirme.
        </li>
      </ol>
    );
  }

  return (
    <ol className={styles.steps}>
      <li>
        Abra o menu do navegador (<strong>⋮</strong> no Chrome, <strong>…</strong> no Edge).
      </li>
      <li>
        Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
      </li>
      <li>Confirme: o ícone do Sou Bizurado aparece junto com os outros apps.</li>
    </ol>
  );
}
