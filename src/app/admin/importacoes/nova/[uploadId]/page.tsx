import Link from "next/link";
import { notFound } from "next/navigation";

import {
  OFFICIAL_EXAM_BOARDS,
  type OfficialExamQuestion,
} from "@/modules/imports/application/official-exams/official-exam";
import {
  resolveExamSection,
  type SectionResolution,
} from "@/modules/imports/application/official-exams/resolve-exam-section";
import {
  isValidUploadId,
  loadAnalysis,
  loadResult,
} from "@/modules/imports/infrastructure/official-exams/official-exam-upload-store";
import { loadSectionTaxonomyEntries } from "@/modules/imports/infrastructure/official-exams/run-official-exam-import";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { RichText } from "@/shared/ui/rich-text";

import { SubmitButton } from "../../../_components/submit-button";
import { confirmOfficialExamImportAction } from "../../actions";
import styles from "../../importacoes.module.css";

export const dynamic = "force-dynamic";

type PreviewPageProps = Readonly<{
  params: Promise<Readonly<{ uploadId: string }>>;
  searchParams: Promise<Readonly<{ error?: string; imported?: string }>>;
}>;

function describeResolution(
  resolution: SectionResolution,
  areaNames: ReadonlyMap<string, string>,
): string {
  if (resolution.kind === "DISCIPLINE") {
    return `Disciplina: ${resolution.disciplineName}`;
  }

  if (resolution.kind === "KNOWLEDGE_AREA") {
    return `Área: ${areaNames.get(resolution.knowledgeAreaSlug) ?? resolution.knowledgeAreaSlug} (a disciplina será definida na classificação)`;
  }

  return "Não identificada — escolha abaixo";
}

function mediaUrl(uploadId: string, file: string): string {
  return `/api/admin/official-exams/${uploadId}/media/${encodeURIComponent(file)}`;
}

function QuestionPreview({
  uploadId,
  question,
}: Readonly<{ uploadId: string; question: OfficialExamQuestion }>) {
  const images = [...question.supportImages, ...question.images];

  return (
    <li className={`${styles.question} ${question.annulled ? styles.questionAnnulled : ""}`}>
      <div className={styles.questionTop}>
        <span className={styles.questionNumber}>
          Questão {question.number}
          {question.variant > 0 ? ` (variante ${question.variant + 1})` : ""}
        </span>
        {question.section ? <span>{question.section}</span> : null}
        {question.annulled ? (
          <span className={`${styles.badge} ${styles.badgeDanger}`}>Anulada · não será importada</span>
        ) : (
          <span className={`${styles.badge} ${styles.badgeOk}`}>Gabarito {question.answer}</span>
        )}
        {question.refersToHighlight ? (
          <span className={`${styles.badge} ${styles.badgeWarning}`}>Cita termo destacado · conferir no PDF</span>
        ) : null}
        {images.length > 0 ? (
          <span className={`${styles.badge} ${styles.badgeInfo}`}>
            {images.length} imagem{images.length === 1 ? "" : "ns"}
          </span>
        ) : null}
      </div>

      {question.supportText ? (
        <details className={styles.support}>
          <summary>Texto de apoio</summary>
          <p>
            <RichText text={question.supportText} />
          </p>
        </details>
      ) : null}

      <p className={styles.statement}>
        <RichText text={question.statement} />
      </p>

      {images.length > 0 ? (
        <div className={styles.images}>
          {images.map((file) => (
            // eslint-disable-next-line @next/next/no-img-element -- private admin preview served by a route handler
            <img key={file} src={mediaUrl(uploadId, file)} alt={`Imagem da questão ${question.number}`} loading="lazy" />
          ))}
        </div>
      ) : null}

      <ol className={styles.alternatives}>
        {question.alternatives.map((alternative) => (
          <li
            key={alternative.label}
            className={`${styles.alternative} ${alternative.label === question.answer ? styles.alternativeCorrect : ""}`}
          >
            <span className={styles.alternativeLetter}>{alternative.label}</span>
            <span>
              <RichText text={alternative.content} />
              {alternative.images.length > 0 ? (
                <span className={styles.images}>
                  {alternative.images.map((file) => (
                    // eslint-disable-next-line @next/next/no-img-element -- private admin preview served by a route handler
                    <img key={file} src={mediaUrl(uploadId, file)} alt={`Imagem da alternativa ${alternative.label}`} loading="lazy" />
                  ))}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </li>
  );
}

export default async function OfficialExamPreviewPage({ params, searchParams }: PreviewPageProps) {
  const { uploadId } = await params;
  const { error, imported } = await searchParams;

  if (!isValidUploadId(uploadId)) {
    notFound();
  }

  const [analysis, result] = await Promise.all([loadAnalysis(uploadId), loadResult(uploadId)]);

  if (!analysis) {
    notFound();
  }

  const [entries, knowledgeAreas] = await Promise.all([
    loadSectionTaxonomyEntries(),
    getPrismaClient().knowledgeArea.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  const areaNames = new Map(knowledgeAreas.map((area) => [area.slug, area.name]));
  const sectionNames = [...new Set(analysis.questions.map((question) => question.section ?? ""))];
  const sections = sectionNames.map((name) => ({
    name,
    count: analysis.questions.filter((question) => (question.section ?? "") === name).length,
    resolution: resolveExamSection(name || null, entries),
  }));

  const annulled = analysis.questions.filter((question) => question.annulled);
  const importable = analysis.questions.filter((question) => !question.annulled && question.answer);
  const withImages = analysis.questions.filter(
    (question) =>
      question.images.length + question.supportImages.length > 0 ||
      question.alternatives.some((alternative) => alternative.images.length > 0),
  );
  const highlighted = analysis.questions.filter((question) => question.refersToHighlight);
  const hasBlockingIssues = analysis.blockingIssues.length > 0;
  const disciplinesByArea = knowledgeAreas.map((area) => ({
    ...area,
    disciplines: entries
      .filter((entry) => entry.knowledgeAreaSlug === area.slug)
      .sort((left, right) => left.disciplineName.localeCompare(right.disciplineName, "pt-BR")),
  }));

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/admin/importacoes">Central de importações</Link>
        <span aria-hidden="true">/</span>
        <span>Prévia</span>
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {analysis.board ? OFFICIAL_EXAM_BOARDS[analysis.board] : "Banca não identificada"}
          </p>
          <h1>Prévia da importação</h1>
          <p className={styles.description}>
            {analysis.bookletFileName} · gabarito {analysis.answerKeyFileName}
          </p>
        </div>
      </header>

      {imported === "1" && result ? (
        <div className={styles.noticeSuccess} role="status">
          Importação concluída: {result.counts.imported} questões novas, {result.counts.duplicates} já existentes,
          {" "}{result.counts.reviewRequired} para revisão, {result.counts.failed} falhas. {result.skippedAnnulled} anuladas
          não importadas; {result.mediaTasks.completed} imagens armazenadas; {result.classificationEnqueued} questões
          enviadas para a classificação automática.{" "}
          <Link href="/admin/questoes/revisao">Abrir revisão editorial</Link>
        </div>
      ) : null}

      {error ? (
        <div className={styles.noticeError} role="alert">
          {error.slice(0, 300)}
        </div>
      ) : null}

      {hasBlockingIssues ? (
        <div className={styles.noticeError} role="alert">
          <strong>Pendências que impedem a importação:</strong>
          <ul>
            {analysis.blockingIssues.slice(0, 20).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Questões lidas</dt>
          <dd>{analysis.questions.length}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Serão importadas</dt>
          <dd>{importable.length}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Anuladas</dt>
          <dd>{annulled.length}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Com imagens</dt>
          <dd>{withImages.length}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Conferir destaque</dt>
          <dd>{highlighted.length}</dd>
        </div>
      </dl>

      {analysis.questions.length > 0 ? (
        <form action={confirmOfficialExamImportAction} className={styles.page}>
          <input type="hidden" name="uploadId" value={analysis.uploadId} />

          <section className={styles.card}>
            <div>
              <h2 className={styles.cardTitle}>Concurso</h2>
              <p className={styles.cardMeta}>
                Estes dados identificam a prova (banca, órgão, cargo e ano) em todas as questões importadas.
              </p>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Órgão / instituição</span>
                <input name="organization" defaultValue={analysis.detected.organization ?? ""} required maxLength={200} />
              </label>
              <label className={styles.field}>
                <span>Cargo</span>
                <input name="careerPosition" defaultValue={analysis.detected.careerPosition ?? ""} required maxLength={180} />
              </label>
              <label className={styles.field}>
                <span>Ano</span>
                <input name="year" type="number" min={1990} max={2100} defaultValue={analysis.detected.year ?? ""} required />
              </label>
              <label className={styles.field}>
                <span>Nível</span>
                <input name="level" defaultValue={analysis.detected.level ?? ""} maxLength={40} />
              </label>
              <label className={`${styles.field}`}>
                <span>Edital / portaria</span>
                <input name="notice" defaultValue={analysis.detected.notice ?? ""} maxLength={160} />
              </label>
              <label className={styles.field}>
                <span>Título da prova (opcional)</span>
                <input name="title" placeholder="Gerado a partir de órgão, ano e cargo" maxLength={240} />
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <div>
              <h2 className={styles.cardTitle}>Matérias da prova</h2>
              <p className={styles.cardMeta}>
                Cada seção do caderno foi associada automaticamente à taxonomia. Ajuste se necessário. Seções genéricas
                (ex.: &ldquo;Noções de Direito&rdquo;) ficam só com a área; a classificação automática define a disciplina e o tópico.
              </p>
            </div>

            <ul className={styles.sectionList}>
              {sections.map((section, index) => (
                <li key={section.name || "sem-secao"} className={styles.sectionRow}>
                  <div className={styles.sectionName}>
                    <strong>{section.name || "(sem seção)"}</strong>
                    <span>
                      {section.count} questões · {describeResolution(section.resolution, areaNames)}
                    </span>
                  </div>

                  <select
                    name={`section-${index}`}
                    defaultValue="auto"
                    aria-label={`Matéria da seção ${section.name || "sem seção"}`}
                  >
                    <option value="auto">
                      {section.resolution.kind === "UNRESOLVED" ? "Escolha a disciplina ou área…" : "Manter associação automática"}
                    </option>
                    {disciplinesByArea.map((area) => (
                      <optgroup key={area.slug} label={area.name}>
                        <option value={`area:${area.slug}`}>Somente a área ({area.name})</option>
                        {area.disciplines.map((entry) => (
                          <option key={entry.disciplineName} value={`discipline:${entry.disciplineName}`}>
                            {entry.disciplineName}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card}>
            <div>
              <h2 className={styles.cardTitle}>Questões</h2>
              <p className={styles.cardMeta}>
                Confira enunciados, imagens e o gabarito (em verde). Anuladas aparecem esmaecidas e não são importadas.
              </p>
            </div>

            <ol className={styles.questionList}>
              {analysis.questions.map((question) => (
                <QuestionPreview key={question.key} uploadId={analysis.uploadId} question={question} />
              ))}
            </ol>
          </section>

          <div className={styles.confirmBar}>
            <p>
              {result
                ? "Esta prova já foi importada. Importar de novo não duplica questões (elas são deduplicadas)."
                : `${importable.length} questões entrarão em revisão; nenhuma é publicada automaticamente.`}
            </p>
            <SubmitButton className={styles.primaryButton} pendingLabel="Importando…" disabled={hasBlockingIssues}>
              Confirmar importação
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </main>
  );
}
