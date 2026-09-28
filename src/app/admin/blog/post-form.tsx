import styles from "../loja/loja.module.css";
import { savePostAction } from "./actions";

export type PostFormValues = Readonly<{
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "DRAFT" | "PUBLISHED";
  publishAt: string;
  category: string;
  relatedOfferId: string | null;
  relatedBoardId: string | null;
  hasCover: boolean;
  imageCount: number;
}>;

type Option = Readonly<{ id: string; name: string }>;

export function PostForm({
  values,
  categories,
  offers,
  boards,
}: Readonly<{ values: PostFormValues; categories: readonly string[]; offers: readonly Option[]; boards: readonly Option[] }>) {
  return (
    <form action={savePostAction} className={styles.form}>
      {values.id ? <input type="hidden" name="postId" value={values.id} /> : null}

      <label className={`${styles.field} ${styles.full}`}>
        <span>Título</span>
        <input name="title" defaultValue={values.title} required minLength={5} maxLength={200} placeholder="Edital PMPE 2027: 2.400 vagas para soldado" />
      </label>
      <label className={styles.field}>
        <span>Endereço (slug)</span>
        <input name="slug" defaultValue={values.slug} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="gerado a partir do título" />
      </label>
      <label className={styles.field}>
        <span>Categoria</span>
        <input name="category" defaultValue={values.category} list="blog-categories" maxLength={120} placeholder="Editais" />
        <datalist id="blog-categories">
          {categories.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Resumo (aparece no Google e na lista; vazio = gerado do texto)</span>
        <textarea name="excerpt" defaultValue={values.excerpt} rows={2} maxLength={320} />
      </label>
      <label className={`${styles.field} ${styles.full}`}>
        <span>
          Texto — separe blocos com uma linha em branco. <code>## Título</code>, <code>### Subtítulo</code>, <code>- item</code>,{" "}
          <code>1. item</code>, <code>&gt; citação</code>, <code>**negrito**</code>, <code>_itálico_</code>,{" "}
          <code>[texto](https://link)</code> e <code>[imagem 1]</code> sozinho numa linha.
        </span>
        <textarea name="body" defaultValue={values.body} rows={22} maxLength={200000} required />
      </label>

      <label className={styles.field}>
        <span>Situação</span>
        <select name="status" defaultValue={values.status}>
          <option value="DRAFT">Rascunho</option>
          <option value="PUBLISHED">Publicado</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>Publicar em (horário de Brasília; vazio = agora)</span>
        <input name="publishAt" type="datetime-local" defaultValue={values.publishAt} />
      </label>

      <label className={styles.field}>
        <span>Capa {values.hasCover ? "(já tem — envie outra para trocar)" : "(opcional)"}</span>
        <input name="cover" type="file" accept="image/png,image/jpeg,image/webp" />
      </label>
      {values.hasCover ? (
        <div className={styles.checks}>
          <label>
            <input type="checkbox" name="removeCover" /> Remover a capa
          </label>
        </div>
      ) : (
        <span />
      )}
      <label className={`${styles.field} ${styles.full}`}>
        <span>
          Imagens do texto (até 10 por vez; entram como [imagem {values.imageCount + 1}], [imagem {values.imageCount + 2}]…)
          {values.imageCount > 0 ? ` — já há ${values.imageCount}.` : ""}
        </span>
        <input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple />
      </label>

      <label className={styles.field}>
        <span>Oferta em destaque no post (chamada para a Loja)</span>
        <select name="relatedOfferId" defaultValue={values.relatedOfferId ?? ""}>
          <option value="">Nenhuma</option>
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Banca (chamada &quot;resolva questões da banca&quot;)</span>
        <select name="relatedBoardId" defaultValue={values.relatedBoardId ?? ""}>
          <option value="">Nenhuma</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.full}>
        <button type="submit" className={styles.primary}>
          {values.id ? "Salvar post" : "Criar post"}
        </button>
      </div>
    </form>
  );
}
