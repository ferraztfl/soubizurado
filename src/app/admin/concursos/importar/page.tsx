import Link from "next/link";

import { isNoticeAiConfigured } from "@/modules/contests/infrastructure/notice-reader";
import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../../loja/loja.module.css";
import { loadContestFormOptions } from "../load-contest-form-options";
import { NoticeImporter } from "./notice-importer";

export const dynamic = "force-dynamic";

type ImportNoticePageProps = Readonly<{ searchParams: Promise<Readonly<{ erro?: string }>> }>;

export default async function ImportNoticePage(props: ImportNoticePageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const [options, contests] = await Promise.all([
    loadContestFormOptions(),
    getPrismaClient().contest.findMany({ orderBy: { name: "asc" }, take: 500, select: { id: true, name: true } }),
  ]);

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/concursos">Concursos</Link> / <span>Importar do edital</span>
      </nav>
      <header>
        <h1 className={styles.title}>Importar do edital (PDF)</h1>
        <p className={styles.description}>
          A IA lê o edital oficial e preenche o cadastro do concurso (órgão, banca, cargos, vagas, salários, datas, taxa, etapas) e um
          rascunho de notícia. Nada é salvo nem publicado sem a sua revisão.
        </p>
      </header>

      {!isNoticeAiConfigured() ? (
        <p className={styles.error}>A IA não está configurada no .env (CLASSIFIER_API_BASE_URL e CLASSIFIER_MODEL).</p>
      ) : null}
      {params.erro ? <p className={styles.error}>{params.erro.slice(0, 300)}</p> : null}

      <NoticeImporter contests={contests} {...options} />
    </main>
  );
}
