import type { Metadata } from "next";
import Link from "next/link";

import { FREE_DAILY_ANSWERS } from "@/modules/study/domain/access";
import { formatBRL } from "@/modules/store/domain/store";
import {
  DEFAULT_SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLANS,
  YEARLY_PREMIUM_OFFER_SLUG,
  monthlyEquivalentCents,
  monthlyPriceLabel,
  pricePerDayCents,
} from "@/modules/store/domain/subscription";
import { subscribeAction, subscribeNewAccountAction } from "@/modules/store/presentation/subscription-actions";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { loadSiteViewer } from "../_components/site-viewer";
import styles from "./assinatura.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const yearly = await loadYearlyOffer();
  const from = yearly ? `${formatBRL(monthlyEquivalentCents(yearly.priceCents))}/mês` : monthlyPriceLabel();
  return {
    title: `Assinatura Premium — questões ilimitadas a partir de ${from}`,
    description: `Assine o Sou Bizurado Premium: questões e simulados ilimitados, revisão dos seus erros e desempenho completo. Mensal por ${monthlyPriceLabel()}${yearly ? ` ou anual por ${formatBRL(yearly.priceCents)}` : ""}.`,
    alternates: { canonical: "/assinatura" },
  };
}

/** The one-time yearly Premium offer, when it is on sale. */
async function loadYearlyOffer() {
  const offer = await getPrismaClient().offer.findUnique({
    where: { slug: YEARLY_PREMIUM_OFFER_SLUG },
    select: { slug: true, priceCents: true, isActive: true },
  });
  return offer?.isActive ? offer : null;
}

/** 1490 → ["14", "90"]. */
function splitPrice(amountCents: number): [string, string] {
  const [reais = "", cents = ""] = formatBRL(amountCents).replace(/^R\$\s*/, "").split(",");
  return [reais, cents];
}

type SubscriptionPageProps = Readonly<{ searchParams: Promise<Readonly<{ erro?: string }>> }>;

const ERRORS: Readonly<Record<string, string>> = {
  termos: "Para assinar, aceite os Termos de uso.",
  configuracao: "A assinatura ainda não está disponível. Tente novamente em breve.",
  pagamento: "Não foi possível abrir o pagamento no Mercado Pago. Tente novamente em instantes.",
  sessao: "Sua sessão expirou. Entre novamente para assinar.",
  dados: "Confira nome, e-mail e senha (mínimo de 8 caracteres).",
  "conta-existe": "Já existe uma conta com esse e-mail. Entre para assinar.",
};

const PREMIUM_FEATURES = [
  "Todos os cursos Teoria Completa (PMPE, CBMPE e próximos editais)",
  "Questões ilimitadas, todos os dias",
  "Simulados ilimitados no tempo da prova",
  "Revisão espaçada dos seus erros",
  "Desempenho por matéria e assunto",
  "Metas, missões e ranking",
] as const;

const COMPARISON = [
  { label: "Cursos Teoria Completa (todos os editais)", free: "Aulas de amostra", premium: "Todos incluídos" },
  { label: "Questões com gabarito oficial", free: `${FREE_DAILY_ANSWERS.free} por dia`, premium: "Ilimitadas" },
  { label: "Simulados", free: "Dentro do limite diário", premium: "Ilimitados" },
  { label: "Revisão dos erros", free: "Sim", premium: "Sim, sem limite" },
  { label: "Filtros por matéria, banca, órgão e ano", free: "Sim", premium: "Sim" },
  { label: "Desempenho e ranking", free: "Sim", premium: "Sim" },
] as const;

const FAQ = [
  {
    question: "Como funciona a cobrança?",
    answer:
      "A assinatura é mensal, com renovação automática no cartão de crédito pelo Mercado Pago. O Premium é liberado assim que o primeiro pagamento é aprovado e renova a cada mês.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim, sem multa e sem fidelidade, em Minha área → Assinatura. O cancelamento interrompe as próximas cobranças e você continua Premium até o fim do mês já pago.",
  },
  {
    question: "E se eu me arrepender?",
    answer:
      "Você pode desistir em até 7 dias da contratação (direito de arrependimento, art. 49 do Código de Defesa do Consumidor) e receber o valor de volta. Fale com a gente pelo e-mail de contato.",
  },
  {
    question: "Prefiro pagar por Pix, sem renovação automática.",
    answer: "Veja os combos na Loja: você paga uma vez (Pix, cartão ou boleto) e recebe o Premium pelo período do combo.",
  },
] as const;

export default async function SubscriptionPage({ searchParams }: SubscriptionPageProps) {
  const [params, viewer, yearly] = await Promise.all([searchParams, loadSiteViewer(), loadYearlyOffer()]);
  const plan = SUBSCRIPTION_PLANS[DEFAULT_SUBSCRIPTION_PLAN];
  const error = params.erro ? ERRORS[params.erro] : null;
  const [reais, cents] = splitPrice(plan.amountCents);
  const yearlyMonthCents = yearly ? monthlyEquivalentCents(yearly.priceCents) : null;
  const [yearlyReais, yearlyCents] = yearlyMonthCents === null ? ["", ""] : splitPrice(yearlyMonthCents);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Sou Bizurado Premium</span>
        <h1>
          {yearlyMonthCents === null ? (
            <>
              Estude sem limites por <span>só {formatBRL(pricePerDayCents(DEFAULT_SUBSCRIPTION_PLAN))} por dia</span>
            </>
          ) : (
            <>
              Estude sem limites a partir de <span>{formatBRL(yearlyMonthCents)} por mês</span>
            </>
          )}
        </h1>
        <p>Todos os cursos Teoria Completa, questões e simulados ilimitados, revisão dos seus erros e desempenho completo. Cancele quando quiser.</p>
      </section>

      <section className={yearly ? styles.plansThree : styles.plans} aria-label="Planos">
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <article className={styles.plan}>
          <span className={styles.planName}>Grátis</span>
          <div className={styles.price}>
            <strong>R$ 0</strong>
          </div>
          <p className={styles.planNote}>Para conhecer a plataforma.</p>
          <ul>
            <li>{FREE_DAILY_ANSWERS.free} questões por dia</li>
            <li>Revisão dos erros e metas</li>
            <li>Notícias e concursos</li>
          </ul>
          {viewer.signedIn ? (
            <Link href="/app" className={styles.secondary}>
              Ir para minha área
            </Link>
          ) : (
            <Link href="/cadastro" className={styles.secondary}>
              Criar conta grátis
            </Link>
          )}
        </article>

        <article className={yearly ? styles.plan : styles.planFeatured}>
          {yearly ? null : <span className={styles.ribbon}>Recomendado</span>}
          <span className={styles.planName}>Premium mensal</span>
          <div className={styles.price}>
            <small>R$</small>
            <strong>{reais}</strong>
            <b>,{cents}</b>
            <em>/mês</em>
          </div>
          <p className={styles.planNote}>Renovação mensal automática. Cancele quando quiser.</p>
          <ul>
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>

          {viewer.premium ? (
            <Link href="/app/assinatura" className={styles.primary}>
              Você já é Premium — ver assinatura
            </Link>
          ) : viewer.signedIn ? (
            <form action={subscribeAction} className={styles.form}>
              <label className={styles.terms}>
                <input type="checkbox" name="acceptTerms" required /> Li e aceito os{" "}
                <Link href="/termos" target="_blank">
                  Termos de uso
                </Link>
              </label>
              <button type="submit" className={styles.primary}>
                Assinar por {formatBRL(plan.amountCents)}/mês
              </button>
            </form>
          ) : (
            <form action={subscribeNewAccountAction} className={styles.form}>
              <label>
                <span>Seu nome</span>
                <input name="displayName" required minLength={2} maxLength={120} autoComplete="name" />
              </label>
              <label>
                <span>E-mail</span>
                <input name="email" type="email" required maxLength={254} autoComplete="email" />
              </label>
              <label>
                <span>Crie uma senha (mínimo 8 caracteres)</span>
                <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
              </label>
              <label className={styles.terms}>
                <input type="checkbox" name="acceptTerms" required /> Li e aceito os{" "}
                <Link href="/termos" target="_blank">
                  Termos de uso
                </Link>
              </label>
              <button type="submit" className={styles.primary}>
                Criar conta e assinar
              </button>
              <p className={styles.formHint}>
                Já tem conta? <Link href="/login?next=/assinatura">Entre para assinar</Link>
              </p>
            </form>
          )}
          <p className={styles.secure}>Pagamento seguro pelo Mercado Pago · cartão de crédito</p>
        </article>

        {yearly ? (
          <article className={styles.planFeatured}>
            <span className={styles.ribbon}>Mais econômico</span>
            <span className={styles.planName}>Premium anual</span>
            <div className={styles.price}>
              <small>R$</small>
              <strong>{yearlyReais}</strong>
              <b>,{yearlyCents}</b>
              <em>/mês</em>
            </div>
            <p className={styles.planNote}>
              {formatBRL(yearly.priceCents)} por 12 meses, pagamento único. Sem renovação automática.
            </p>
            <ul>
              {PREMIUM_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <Link href={`/loja/${yearly.slug}`} className={styles.primary}>
              {viewer.premium ? "Garantir mais 12 meses" : "Quero o plano anual"}
            </Link>
            <p className={styles.secure}>Pagamento seguro pelo Mercado Pago · Pix, cartão ou boleto</p>
          </article>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2>Grátis ou Premium?</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Recurso</th>
                <th scope="col">Grátis</th>
                <th scope="col">Premium</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.free}</td>
                  <td>{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
}
