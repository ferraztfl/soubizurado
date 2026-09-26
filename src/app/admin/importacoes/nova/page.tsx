import Link from "next/link";

import { SubmitButton } from "../../_components/submit-button";
import { uploadExamJsonAction, uploadOfficialExamAction } from "../actions";
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
          <li>O formato é identificado pela capa (hoje: Instituto AOCP, múltipla escolha e Verdadeiro/Falso). Outras bancas: use a importação por JSON abaixo.</li>
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

      <form action={uploadExamJsonAction} className={styles.card}>
        <div>
          <h2 className={styles.cardTitle}>Importar arquivo JSON (padrão SouBizurado)</h2>
          <p className={styles.cardMeta}>
            Para provas de qualquer banca convertidas por ferramenta externa (ex.: app no Google AI Studio). O
            JSON traz questões e gabarito; as imagens são recortadas do PDF do caderno. Veja o formato e os
            prompts em <code>docs/importacao-json/</code>.
          </p>
        </div>

        <div className={styles.uploadGrid}>
          <label className={styles.dropField}>
            <span>Arquivo JSON da prova</span>
            <small>Formato soubizurado.exam.v1, com o gabarito incluído.</small>
            <input type="file" name="examJson" accept="application/json,.json" required />
          </label>

          <label className={styles.dropField}>
            <span>Caderno de questões (PDF)</span>
            <small>Obrigatório se o JSON tiver imagens (as regiões indicadas são recortadas daqui).</small>
            <input type="file" name="booklet" accept="application/pdf,.pdf" />
          </label>
        </div>

        <div>
          <SubmitButton className={styles.secondaryButton} pendingLabel="Validando o JSON…">
            Validar JSON
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}
