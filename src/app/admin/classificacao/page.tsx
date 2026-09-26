import Link from "next/link";

import { getClassificationRunState } from "@/modules/classification/infrastructure/classification-run-manager";
import {
  createQuestionClassifier,
  readAutoApply,
  readMinimumConfidence,
  readRulesThreshold,
} from "@/modules/classification/infrastructure/create-question-classifier";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { SubmitButton } from "../_components/submit-button";
import { startClassificationRunAction, stopClassificationRunAction } from "./actions";
import { AutoRefresh } from "./auto-refresh";
import styles from "./classificacao.module.css";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  searchParams: Promise<Readonly<{ busy?: string }>>;
}>;

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function ClassificationPage(props: PageProps) {
  await requireAdminUser();

  const searchParams = await props.searchParams;
  const run = getClassificationRunState();
  const prisma = getPrismaClient();

  let classifierLabel = "Não configurado";
  let classifierVersion: string | null = null;
  let configError: string | null = null;

  try {
    const classifier = createQuestionClassifier();
    classifierLabel = classifier.model ? `${classifier.provider} · ${classifier.model}` : classifier.provider;
    classifierVersion = classifier.version;
  } catch (error) {
    configError = error instanceof Error ? error.message : "Configuração inválida.";
  }

  const [unclassified, pending, appliedByPipeline, awaitingReview] = await Promise.all([
    prisma.question.count({
      where: { status: { in: ["DRAFT", "IN_REVIEW"] }, topicId: null, knowledgeAreaId: { not: null } },
    }),
    classifierVersion
      ? prisma.questionClassificationTask.count({
          where: { classifierVersion, status: { in: ["PENDING", "PROCESSING"] } },
        })
      : Promise.resolve(0),
    prisma.questionClassificationTask.count({
      where: { appliedAt: { not: null }, appliedByProfileId: null },
    }),
    prisma.questionClassificationTask.count({
      where: {
        // Current pipeline only: older runs (rule-based-v1) left weak suggestions.
        classifierVersion: classifierVersion ?? "",
        status: "REVIEW_REQUIRED",
        appliedAt: null,
        suggestedTopicId: { not: null },
        question: { status: "IN_REVIEW", topicId: null },
      },
    }),
  ]);

  const active = run.status !== "IDLE";

  return (
    <main className={styles.page}>
      <AutoRefresh active={active} />

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Banco de questões</p>
          <h1>Classificação automática</h1>
          <p className={styles.description}>
            Um clique classifica todas as questões pendentes: primeiro as regras (leis, artigos, palavras-chave),
            depois a IA. Resultados com confiança alta são gravados sozinhos; os demais ficam como sugestão na
            revisão editorial. Nada é publicado automaticamente.
          </p>
        </div>
      </header>

      {configError ? (
        <div className={styles.noticeError} role="alert">
          Classificador mal configurado: {configError}
        </div>
      ) : null}

      {searchParams.busy === "1" ? (
        <div className={styles.notice} role="status">
          Já existe uma classificação em andamento.
        </div>
      ) : null}

      <dl className={styles.stats}>
        <div>
          <dt>Sem classificação</dt>
          <dd>{numberFormatter.format(unclassified)}</dd>
        </div>
        <div>
          <dt>Na fila</dt>
          <dd>{numberFormatter.format(pending)}</dd>
        </div>
        <div>
          <dt>Gravadas automaticamente</dt>
          <dd>{numberFormatter.format(appliedByPipeline)}</dd>
        </div>
        <div>
          <dt>Aguardando revisão</dt>
          <dd>
            <Link href="/admin/questoes/revisao?suggestion=with">{numberFormatter.format(awaitingReview)}</Link>
          </dd>
        </div>
      </dl>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              {run.status === "RUNNING"
                ? "Classificando…"
                : run.status === "STOPPING"
                  ? "Interrompendo após o lote atual…"
                  : "Pronto para classificar"}
            </h2>
            <p className={styles.cardMeta}>
              {run.startedAt ? `Iniciada em ${dateFormatter.format(new Date(run.startedAt))}` : "Nenhuma execução nesta sessão do servidor."}
              {run.finishedAt && !active ? ` · terminou em ${dateFormatter.format(new Date(run.finishedAt))}` : ""}
            </p>
          </div>

          {active ? (
            <form action={stopClassificationRunAction}>
              <SubmitButton pendingLabel="Interrompendo…" className={styles.secondaryButton} disabled={run.status === "STOPPING"}>
                Interromper
              </SubmitButton>
            </form>
          ) : (
            <form action={startClassificationRunAction}>
              <SubmitButton pendingLabel="Iniciando…" className={styles.primaryButton} disabled={Boolean(configError) || unclassified === 0}>
                Classificar pendentes
              </SubmitButton>
            </form>
          )}
        </div>

        {run.startedAt ? (
          <dl className={styles.runStats}>
            <div>
              <dt>Enfileiradas</dt>
              <dd>{numberFormatter.format(run.enqueued)}</dd>
            </div>
            <div>
              <dt>Processadas</dt>
              <dd>{numberFormatter.format(run.processed)}</dd>
            </div>
            <div>
              <dt>Gravadas</dt>
              <dd>{numberFormatter.format(run.applied)}</dd>
            </div>
            <div>
              <dt>Pelas regras</dt>
              <dd>{numberFormatter.format(run.answeredByRules)}</dd>
            </div>
            <div>
              <dt>Para revisão</dt>
              <dd>{numberFormatter.format(run.reviewRequired)}</dd>
            </div>
            <div>
              <dt>Falhas</dt>
              <dd>{numberFormatter.format(run.failed)}</dd>
            </div>
          </dl>
        ) : null}

        {run.endReason && !active ? <p className={styles.endReason}>{run.endReason}</p> : null}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Configuração</h2>
        <dl className={styles.config}>
          <div>
            <dt>Classificador</dt>
            <dd>{classifierLabel}</dd>
          </div>
          <div>
            <dt>Regras dispensam a IA a partir de</dt>
            <dd>{configError ? "—" : percent(readRulesThreshold())}</dd>
          </div>
          <div>
            <dt>Gravação automática</dt>
            <dd>{configError ? "—" : readAutoApply() ? `Ligada (confiança ≥ ${percent(readMinimumConfidence())})` : "Desligada"}</dd>
          </div>
        </dl>
        <p className={styles.cardMeta}>
          Ajustes pelo <code>.env</code> (CLASSIFIER_RULES_THRESHOLD, CLASSIFIER_MIN_CONFIDENCE, CLASSIFIER_AUTO_APPLY,
          CLASSIFIER_REQUESTS_PER_MINUTE). A execução roda neste servidor; se ele reiniciar, clique de novo para
          continuar de onde parou.
        </p>
      </section>
    </main>
  );
}
