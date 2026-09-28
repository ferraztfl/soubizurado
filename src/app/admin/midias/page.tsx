import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { formatQuestionCode } from "@/modules/question-bank/domain/question-code";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { retryMediaTaskAction } from "./actions";
import styles from "./midias.module.css";

export const dynamic = "force-dynamic";

type MediaPageProps = Readonly<{
  searchParams: Promise<Readonly<{ retried?: string; error?: string }>>;
}>;

const STATUS_LABELS = [
  { value: "PENDING", label: "Na fila" },
  { value: "PROCESSING", label: "Baixando" },
  { value: "COMPLETED", label: "Concluídas" },
  { value: "FAILED", label: "Com falha" },
] as const;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

/** Host only: full source URLs can be long and carry tokens. */
function sourceHost(url: string): string {
  try {
    return new URL(url).host || url.split("/")[0] || url;
  } catch {
    return url.split("/").slice(0, 3).join("/");
  }
}

export default async function MediaPage(props: MediaPageProps) {
  await requireAdminUser();

  const searchParams = await props.searchParams;
  const prisma = getPrismaClient();
  const taskSelect = {
    id: true,
    sourceUrl: true,
    role: true,
    attempts: true,
    errorMessage: true,
    updatedAt: true,
    question: { select: { id: true, publicNumber: true } },
  } as const;

  const [byStatus, assets, byProvider, failed, pending] = await Promise.all([
    prisma.importMediaTask.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.mediaAsset.aggregate({ _count: { _all: true }, _sum: { sizeBytes: true } }),
    prisma.mediaAsset.groupBy({ by: ["storageProvider", "bucket"], _count: { _all: true }, _sum: { sizeBytes: true } }),
    prisma.importMediaTask.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 50, select: taskSelect }),
    prisma.importMediaTask.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: taskSelect,
    }),
  ]);

  const countOf = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
  const number = new Intl.NumberFormat("pt-BR");

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Operação</p>
        <h1 className={styles.title}>Mídias</h1>
        <p className={styles.description}>
          Imagens das questões importadas. Cada imagem é baixada uma vez para o nosso armazenamento privado e servida
          pela rota protegida — nunca direto da fonte. A fila é processada por <code>npm run media:process</code>.
        </p>
      </header>

      {searchParams.retried ? (
        <div className={styles.noticeSuccess} role="status">
          {searchParams.retried} tarefa(s) de volta à fila. Rode <code>npm run media:process</code> para baixar.
        </div>
      ) : null}
      {searchParams.error ? (
        <div className={styles.noticeError} role="alert">
          {searchParams.error.slice(0, 300)}
        </div>
      ) : null}

      <section className={styles.cards} aria-label="Resumo">
        {STATUS_LABELS.map((item) => (
          <div key={item.value} className={item.value === "FAILED" && countOf(item.value) > 0 ? styles.cardAlert : styles.card}>
            <strong>{number.format(countOf(item.value))}</strong>
            <span>{item.label}</span>
          </div>
        ))}
        <div className={styles.card}>
          <strong>{number.format(assets._count._all)}</strong>
          <span>arquivos · {formatBytes(Number(assets._sum.sizeBytes ?? 0))}</span>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Armazenamento</h2>
        <ul className={styles.plainList}>
          {byProvider.map((row) => (
            <li key={`${row.storageProvider}-${row.bucket}`}>
              <strong>{row.storageProvider}</strong> · {row.bucket} — {number.format(row._count._all)} arquivos,{" "}
              {formatBytes(Number(row._sum.sizeBytes ?? 0))}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Falhas</h2>
          {failed.length > 0 ? (
            <form action={retryMediaTaskAction}>
              <input type="hidden" name="taskId" value="all" />
              <button type="submit" className={styles.secondary}>
                Recolocar todas na fila
              </button>
            </form>
          ) : null}
        </div>
        {failed.length === 0 ? (
          <p className={styles.empty}>Nenhuma falha.</p>
        ) : (
          <ul className={styles.list}>
            {failed.map((task) => (
              <li key={task.id} className={styles.item}>
                <div className={styles.itemHead}>
                  {task.question ? (
                    <Link href={`/admin/questoes/${task.question.id}/editar`}>
                      {formatQuestionCode(task.question.publicNumber)}
                    </Link>
                  ) : (
                    <span>Sem questão</span>
                  )}
                  <span className={styles.meta}>
                    {task.role} · {sourceHost(task.sourceUrl)} · {task.attempts} tentativa(s) ·{" "}
                    {dateFormatter.format(task.updatedAt)}
                  </span>
                </div>
                {task.errorMessage ? <p className={styles.error}>{task.errorMessage.slice(0, 400)}</p> : null}
                <form action={retryMediaTaskAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <button type="submit" className={styles.link}>
                    Tentar de novo
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Próximas da fila</h2>
        {pending.length === 0 ? (
          <p className={styles.empty}>Fila vazia.</p>
        ) : (
          <ul className={styles.list}>
            {pending.map((task) => (
              <li key={task.id} className={styles.item}>
                <div className={styles.itemHead}>
                  {task.question ? <span>{formatQuestionCode(task.question.publicNumber)}</span> : <span>Sem questão</span>}
                  <span className={styles.meta}>
                    {task.role} · {sourceHost(task.sourceUrl)} · {task.attempts} tentativa(s)
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
