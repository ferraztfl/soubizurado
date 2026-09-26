import Link from "next/link";

import { SubmitButton } from "../../_components/submit-button";
import { uploadOfficialExamAction } from "../actions";
import styles from "../importacoes.module.css";

type NewImportPageProps = Readonly<{
  searchParams: Promise<Readonly<{ error?: string }>>;
}>;

export default async function NewImportPage({ searchParams }: NewImportPageProps) {
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/admin/importacoes">Central de importações</Link>
        <span aria-hidden="true">/</span>
        <span>Nova importação</span>
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Nova importação</p>
          <h1>Enviar prova oficial</h1>
          <p className={styles.description}>
            Envie o caderno de questões e o gabarito oficial da mesma prova.
            Nada é gravado no banco nesta etapa: primeiro você confere a prévia.
          </p>
        </div>
      </header>

      {error ? (
        <div className={styles.noticeError} role="alert">
          {error.slice(0, 300)}
        </div>
      ) : null}

      <form action={uploadOfficialExamAction} className={styles.card}>
        <div className={styles.uploadGrid}>
          <label className={styles.dropField}>
            <span>Caderno de questões (PDF)</span>
            <small>A prova completa, como publicada pela banca.</small>
            <input type="file" name="booklet" accept="application/pdf,.pdf" required />
          </label>

          <label className={styles.dropField}>
            <span>Gabarito oficial (PDF)</span>
            <small>Preferencialmente o definitivo. Questões anuladas são identificadas automaticamente.</small>
            <input type="file" name="answerKey" accept="application/pdf,.pdf" required />
          </label>
        </div>

        <ol className={styles.steps}>
          <li>A banca é identificada pela capa (hoje: Instituto AOCP; Fundatec e Cebraspe em breve).</li>
          <li>Questões, textos de apoio, imagens e alternativas são lidos e casados com o gabarito.</li>
          <li>Você confere a prévia, ajusta concurso, ano e disciplinas, e confirma.</li>
          <li>As questões entram em revisão (nunca publicadas direto) e vão para a classificação automática.</li>
        </ol>

        <div>
          <SubmitButton className={styles.primaryButton} pendingLabel="Analisando a prova…">
            Analisar prova
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}
