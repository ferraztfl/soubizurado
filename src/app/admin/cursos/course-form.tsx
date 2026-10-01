import styles from "../loja/loja.module.css";
import { saveCourseAction } from "./actions";

export type CourseFormValues = Readonly<{
  id: string | null;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  isPublished: boolean;
  sortOrder: number;
  coverUrl: string | null;
}>;

export function CourseForm({ values }: Readonly<{ values: CourseFormValues }>) {
  return (
    <form action={saveCourseAction} className={styles.form}>
      {values.id ? <input type="hidden" name="courseId" value={values.id} /> : null}
      <label className={`${styles.field} ${styles.full}`}>
        <span>Título</span>
        <input name="title" defaultValue={values.title} required minLength={3} maxLength={160} placeholder="PMPE 2027 — Soldado" />
      </label>
      <label className={styles.field}>
        <span>Endereço (slug)</span>
        <input name="slug" defaultValue={values.slug} maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="gerado a partir do título" />
      </label>
      <label className={styles.field}>
        <span>Ordem</span>
        <input name="sortOrder" type="number" defaultValue={values.sortOrder} min={-1000} max={1000} />
      </label>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Subtítulo</span>
        <input name="subtitle" defaultValue={values.subtitle} maxLength={240} placeholder="Teoria, PDFs e questões comentadas do edital" />
      </label>
      <fieldset className={`${styles.field} ${styles.full}`}>
        <legend>Imagem do curso</legend>
        <p className={styles.hint}>
          Aparece no topo do card em &quot;Meus cursos&quot; e, quando o combo não tem imagem própria, no card da Loja. Use{" "}
          <strong>1200 × 675 px (proporção 16:9, horizontal)</strong>; PNG, JPG ou WebP até 8 MB. Mantenha o assunto principal
          (brasão, texto) no centro: nas telas estreitas as bordas podem ser cortadas.
        </p>
        {values.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={values.coverUrl} alt="Imagem atual do curso" width={240} height={135} style={{ borderRadius: 10, objectFit: "cover" }} />
        ) : null}
        <input name="cover" type="file" accept="image/png,image/jpeg,image/webp" />
        {values.coverUrl ? (
          <label>
            <input type="checkbox" name="removeCover" /> Remover a imagem
          </label>
        ) : null}
      </fieldset>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Descrição (aceita **negrito** e quebras de linha)</span>
        <textarea name="description" defaultValue={values.description} rows={5} maxLength={20000} />
      </label>
      <div className={styles.checks}>
        <label>
          <input type="checkbox" name="isPublished" defaultChecked={values.isPublished} /> Publicado (visível para quem tem acesso)
        </label>
      </div>
      <div className={styles.full}>
        <button type="submit" className={styles.primary}>
          {values.id ? "Salvar curso" : "Criar curso"}
        </button>
      </div>
    </form>
  );
}
