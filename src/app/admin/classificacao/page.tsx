import Link from "next/link";

import { readClassificationBudget } from "@/modules/classification/infrastructure/classification-budget";
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
import { AutoRefresh } from "../_components/auto-refresh";
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

  let budget: ReturnType<typeof readClassificationBudget> | null = null;

  try {
    budget = readClassificationBudget();
  } catch {
    budget = null;
  }

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

  // Live view straight from the queue, so it also shows runs started elsewhere (terminal, another server).
  const [byStatus, processing, recent] = classifierVersion
    ? await Promise.all([
        prisma.questionClassificationTask.groupBy({ by: ["status"], where: { classifierVersion }, _count: true }),
        prisma.questionClassificationTask.findMany({
          where: { classifierVersion, status: "PROCESSING" },
          orderBy: { updatedAt: "asc" },
          take: 8,
          select: { id: true, question: { select: { publicNumber: true, statement: true, discipline: { select: { name: true } } } } },
        }),
        prisma.questionClassificationTask.findMany({
          where: { classifierVersion, status: { in: ["COMPLETED", "REVIEW_REQUIRED"] } },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: {
            id: true,
            status: true,
            appliedAt: true,
            rawResult: true,
            question: { select: { publicNumber: true, discipline: { select: { name: true } }, topic: { select: { name: true } }, subtopic: { select: { name: true } } } },
          },
        }),
      ])
    : [[], [], []];
  const queueCount = (status: string) => byStatus.find((row) => row.status === status)?._count ?? 0;
  const queueTotal = byStatus.reduce((sum, row) => sum + row._count, 0);
  const queueDone = queueCount("COMPLETED") + queueCount("REVIEW_REQUIRED") + queueCount("FAILED");
  const queuePercent = queueTotal > 0 ? Math.round((queueDone / queueTotal) * 100) : 0;
  const active = run.status !== "IDLE" || processing.length > 0;

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
            <form action={startClassificationRunAction} className={styles.startForm}>
              <label className={styles.limitField}>
                <span>Quantas questões</span>
                <select name="limit" defaultValue="50">
                  <option value="50">50 (piloto)</option>
                  <option value="300">300</option>
                  <option value="1000">1.000</option>
                  <option value="all">Todas as pendentes</option>
                </select>
              </label>
              <SubmitButton pendingLabel="Iniciando…" className={styles.primaryButton} disabled={Boolean(configError) || !budget || unclassified === 0}>
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
              <dt>Pela IA local</dt>
              <dd>{numberFormatter.format(run.answeredByLocalAi)}</dd>
            </div>
            <div>
              <dt>Aprendidas de questões já classificadas</dt>
              <dd>{numberFormatter.format(run.answeredBySimilar)}</dd>
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

        {run.startedAt ? (
          <p className={styles.usage}>
            Consumo desta execução: {numberFormatter.format(run.remoteAiCalls)} chamadas pagas à IA ·{" "}
            {numberFormatter.format(run.inputTokens)} tokens de entrada · {numberFormatter.format(run.outputTokens)} de
            saída
            {run.estimatedCostUsd !== null ? ` · custo estimado ≈ US$ ${run.estimatedCostUsd.toFixed(3)}` : ""}
            {run.remoteAiCalls > 0
              ? ` · média ${numberFormatter.format(Math.round((run.inputTokens + run.outputTokens) / run.remoteAiCalls))} tokens por questão`
              : ""}
            {run.maxQuestions !== null ? ` · limite desta execução: ${numberFormatter.format(run.maxQuestions)} questões` : ""}
          </p>
        ) : null}

        {run.endReason && !active ? <p className={styles.endReason}>{run.endReason}</p> : null}
      </section>

      {queueTotal > 0 ? (
        <section className={styles.card} aria-live="polite">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Andamento da fila</h2>
              <p className={styles.cardMeta}>
                {numberFormatter.format(queueDone)} de {numberFormatter.format(queueTotal)} questões processadas ·{" "}
                {numberFormatter.format(queueCount("PENDING"))} aguardando
                {queueCount("FAILED") > 0 ? ` · ${numberFormatter.format(queueCount("FAILED"))} com falha` : ""}
              </p>
            </div>
            <strong className={styles.percent}>{queuePercent}%</strong>
          </div>

          <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={queuePercent} aria-label="Andamento da classificação">
            <span style={{ width: `${queuePercent}%` }} />
          </div>

          {processing.length > 0 ? (
            <>
              <h3 className={styles.subTitle}>Processando agora</h3>
              <ul className={styles.liveList}>
                {processing.map((task) => (
                  <li key={task.id}>
                    <span className={styles.liveCode}>Q{task.question.publicNumber}</span>
                    <span className={styles.liveText}>
                      {task.question.discipline ? <em>{task.question.discipline.name} · </em> : null}
                      {task.question.statement.replace(/\s+/g, " ").slice(0, 170)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {recent.length > 0 ? (
            <>
              <h3 className={styles.subTitle}>Últimas classificadas</h3>
              <ul className={styles.liveList}>
                {recent.map((task) => {
                  const layer = (task.rawResult as { provider?: { layer?: string } } | null)?.provider?.layer;
                  const path = [task.question.discipline?.name, task.question.topic?.name, task.question.subtopic?.name].filter(Boolean).join(" › ");

                  return (
                    <li key={task.id}>
                      <span className={styles.liveCode}>Q{task.question.publicNumber}</span>
                      <span className={styles.liveText}>
                        {task.appliedAt ? path : "Sem classificação segura — fica para sua revisão"}
                        <small>
                          {layer === "RULES" ? " · regras" : layer === "SIMILAR" ? " · aprendida" : layer === "LOCAL_AI" ? " · IA local" : layer === "AI" ? " · IA" : ""}
                          {task.appliedAt ? " · gravada" : ""}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

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
            <dt>Travas de gasto por execução</dt>
            <dd>
              {budget
                ? [
                    `até ${numberFormatter.format(budget.maxAiCallsPerRun)} chamadas`,
                    budget.runBudgetUsd !== null ? `teto ≈ US$ ${budget.runBudgetUsd.toFixed(2)}` : null,
                    budget.inputPricePerMillion === null ? "preços não configurados (sem estimativa em US$)" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Configuração inválida"}
            </dd>
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
