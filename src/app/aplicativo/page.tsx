import type { Metadata } from "next";
import Image from "next/image";
import QRCode from "qrcode";

import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";

import { SiteShell } from "../_components/site-shell";
import styles from "./aplicativo.module.css";
import { InstallButton } from "./install-button";

export const metadata: Metadata = {
  title: "Aplicativo do Sou Bizurado — questões no celular",
  description:
    "Instale o Sou Bizurado no celular (Android e iPhone) ou no computador: questões, simulados e revisão com um toque, com o mesmo login e o mesmo progresso do site.",
  alternates: { canonical: "/aplicativo" },
};

const BENEFITS = [
  {
    title: "Um toque na tela de início",
    text: "Sem digitar endereço nem procurar aba: o ícone do Sou Bizurado fica junto com os seus apps.",
  },
  {
    title: "Tela cheia para estudar",
    text: "Abre sem a barra do navegador — mais espaço para o enunciado e as alternativas.",
  },
  {
    title: "O mesmo login e o mesmo progresso",
    text: "Respostas, revisões, simulados e desempenho são os mesmos do site. Comece no computador, termine no ônibus.",
  },
  {
    title: "Leve e sempre atualizado",
    text: "Não ocupa espaço como um app de loja e recebe as novidades na hora, sem precisar atualizar.",
  },
] as const;

const FAQ = [
  {
    question: "É seguro instalar?",
    answer: "Sim. O app é o próprio site do Sou Bizurado instalado pelo seu navegador — não pede permissões do aparelho.",
  },
  {
    question: "Vou perder meu histórico de questões?",
    answer: "Não. Você entra com a mesma conta e encontra tudo como deixou no site.",
  },
  { question: "Ocupa muito espaço no celular?", answer: "Quase nada: poucos megabytes, bem menos que um aplicativo de loja." },
  { question: "Preciso de internet para usar?", answer: "Sim, as questões e o seu progresso ficam na nuvem." },
  {
    question: "O app é pago?",
    answer: "Não. O app é gratuito; o que muda entre o plano grátis e o Premium é o limite de questões por dia.",
  },
] as const;

export default async function AppPage() {
  const url = `${siteUrl()}/aplicativo`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, width: 200, color: { dark: "#111113", light: "#ffffff" } });

  return (
    <SiteShell mainClassName={styles.main}>
      <section className={styles.hero}>
        <Image src="/icons/icon-192.png" alt="" width={72} height={72} className={styles.appIcon} />
        <span className={styles.eyebrow}>Aplicativo · Android, iPhone e computador · grátis</span>
        <h1>O Sou Bizurado no seu celular</h1>
        <p>Questões, simulados e revisão a um toque da tela de início — com o mesmo login e o mesmo progresso do site.</p>
      </section>

      <section className={styles.card}>
        <div className={styles.install}>
          <h2>Instale agora</h2>
          <InstallButton />
        </div>
        <div className={styles.qr}>
          {/* The SVG comes from our own server-side generator (only our URL goes in). */}
          <div className={styles.qrCode} dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR Code para abrir esta página no celular" role="img" />
          <div>
            <strong>Está no computador?</strong>
            <p>Aponte a câmera do celular para o código: esta página abre no aparelho, com o passo a passo certo para ele.</p>
            <p className={styles.address}>{url.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>O que muda com o app</h2>
        <div className={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <article key={benefit.title}>
              <strong>{benefit.title}</strong>
              <p>{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Perguntas frequentes</h2>
        <div className={styles.faq}>
          {FAQ.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
