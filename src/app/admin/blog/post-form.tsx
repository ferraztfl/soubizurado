import { BRAZIL_STATES } from "@/modules/blog/domain/blog";

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
  contestId: string | null;
  hasCover: boolean;
  imageCount: number;
  format: "NEWS" | "ARTICLE";
  stateCode: string | null;
  isFeatured: boolean;
}>;

type Option = Readonly<{ id: string; name: string }>;

export function PostForm({
  values,
  categories,
  offers,
  boards,
  contests,
}: Readonly<{
  values: PostFormValues;
  categories: readonly string[];
  offers: readonly Option[];
  boards: readonly Option[];
  contests: readonly Option[];
}>) {
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
      <label className={styles.field}>
        <span>Formato</span>
        <select name="format" defaultValue={values.format}>
          <option value="NEWS">Notícia</option>
          <option value="ARTICLE">Artigo (guia, dica de estudo)</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>Região</span>
        <select name="stateCode" defaultValue={values.stateCode ?? ""}>
          <option value="">Nacional</option>
          {Object.entries(BRAZIL_STATES).map(([code, name]) => (
            <option key={code} value={code}>
              {code} — {name}
            </option>
          ))}
        </select>
      </label>
      <div className={`${styles.checks} ${styles.full}`}>
        <label>
          <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} /> Destaque (manchete e faixa &quot;Em destaque&quot;)
        </label>
      </div>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Resumo (aparece no Google e na lista; vazio = gerado do texto)</span>
        <textarea name="excerpt" defaultValue={values.excerpt} rows={2} maxLength={320} />
      </label>
      <label className={`${styles.field} ${styles.full}`}>
        <span>
          Texto — separe blocos com uma linha em branco. <code>## Título</code>, <code>### Subtítulo</code>, <code>- item</code>,{" "}
          <code>1. item</code>, <code>&gt; citação</code>, <code>**negrito**</code>, <code>_itálico_</code>,{" "}
          <code>[texto](https://link)</code> e <code>[imagem 1]</code> sozinho numa linha. Caixas: primeira linha{" "}
          <code>!!! resumo Título</code> (ou <code>atencao</code>, <code>dica</code>, <code>chamada</code>) e, logo abaixo, as linhas
          da caixa (<code>- item</code> vira lista; numa <code>chamada</code>, uma linha só com{" "}
          <code>[Baixar o edital](https://…)</code> vira botão). Tabelas: linhas <code>| Cargo | Vagas |</code>, a primeira é o
          cabeçalho.
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

      <label className={styles.field}>
        <span>Concurso da notícia (aparece na página do concurso)</span>
        <select name="contestId" defaultValue={values.contestId ?? ""}>
          <option value="">Nenhum</option>
          {contests.map((contest) => (
            <option key={contest.id} value={contest.id}>
              {contest.name}
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
