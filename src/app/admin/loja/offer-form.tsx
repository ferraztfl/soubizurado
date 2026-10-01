import { formatBRL } from "@/modules/store/domain/store";

import { saveOfferAction } from "./actions";
import styles from "./loja.module.css";

export type OfferFormValues = Readonly<{
  id: string | null;
  name: string;
  slug: string;
  headline: string;
  description: string;
  priceCents: number | null;
  compareAtCents: number | null;
  promoEndsAt: Date | null;
  premiumDays: number | null | "none";
  allCourses: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  courseIds: readonly string[];
  courseDays: number | null;
  hasBanner: boolean;
  cardImageUrl: string | null;
}>;

export type OfferFormCourse = Readonly<{ id: string; title: string }>;

const cents = (value: number | null) => (value === null ? "" : formatBRL(value).replace(/R\$\s?/, ""));

/** Server-rendered offer form (create and edit). */
export function OfferForm({ values, courses }: Readonly<{ values: OfferFormValues; courses: readonly OfferFormCourse[] }>) {
  const premiumDays = values.premiumDays === "none" ? "" : values.premiumDays === null ? "0" : String(values.premiumDays);

  return (
    <form action={saveOfferAction} className={styles.form}>
      {values.id ? <input type="hidden" name="offerId" value={values.id} /> : null}

      <label className={`${styles.field} ${styles.full}`}>
        <span>Nome</span>
        <input name="name" defaultValue={values.name} required minLength={3} maxLength={160} placeholder="Combo PMPE 2027" />
      </label>
      <label className={styles.field}>
        <span>Endereço (slug)</span>
        <input name="slug" defaultValue={values.slug} maxLength={120} placeholder="gerado a partir do nome" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
      </label>
      <label className={styles.field}>
        <span>Ordem na vitrine</span>
        <input name="sortOrder" type="number" defaultValue={values.sortOrder} min={-1000} max={1000} />
      </label>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Chamada (uma linha)</span>
        <input name="headline" defaultValue={values.headline} maxLength={240} placeholder="App de questões por 6 meses + material da PMPE" />
      </label>
      <label className={styles.field}>
        <span>Preço (R$)</span>
        <input name="price" defaultValue={cents(values.priceCents)} required inputMode="decimal" placeholder="39,90" />
      </label>
      <label className={styles.field}>
        <span>Preço &quot;de&quot; riscado (opcional)</span>
        <input name="compareAt" defaultValue={cents(values.compareAtCents)} inputMode="decimal" placeholder="79,90" />
      </label>
      <label className={styles.field}>
        <span>Promoção até (último dia; depois vale o preço &quot;de&quot;)</span>
        <input name="promoLastDay" type="date" defaultValue={promoLastDayValue(values.promoEndsAt)} />
      </label>
      <label className={styles.field}>
        <span>Dias de Premium (0 = sem prazo; vazio = sem Premium)</span>
        <input name="premiumDays" type="number" min={0} max={3660} defaultValue={premiumDays} placeholder="180" />
      </label>
      <div className={`${styles.checks} ${styles.full}`}>
        <label>
          <input type="checkbox" name="allCourses" defaultChecked={values.allCourses} /> O Premium desta oferta inclui <strong>todos os cursos</strong> (assinatura
          Premium/anual) pelo mesmo prazo — combos de cargo não marcam
        </label>
      </div>
      <fieldset className={`${styles.full} ${styles.courses}`}>
        <legend>Cursos incluídos (área de membros)</legend>
        {courses.length === 0 ? (
          <p className={styles.hint}>Nenhum curso criado ainda — crie em Cursos.</p>
        ) : (
          courses.map((course) => (
            <label key={course.id}>
              <input type="checkbox" name="courseIds" value={course.id} defaultChecked={values.courseIds.includes(course.id)} /> {course.title}
            </label>
          ))
        )}
        <label className={styles.field}>
          <span>Acesso aos cursos em dias (0 ou vazio = sem prazo)</span>
          <input name="courseDays" type="number" min={0} max={3660} defaultValue={values.courseDays ?? ""} placeholder="365" />
        </label>
      </fieldset>
      <div className={styles.checks}>
        <label>
          <input type="checkbox" name="isActive" defaultChecked={values.isActive} /> À venda (aparece na Loja)
        </label>
        <label>
          <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} /> Destaque
        </label>
      </div>
      <fieldset className={`${styles.field} ${styles.full}`}>
        <legend>Imagem do card na Loja</legend>
        <p className={styles.hint}>
          Aparece no topo do card da oferta. Use <strong>1200 × 675 px (proporção 16:9, horizontal)</strong>; PNG, JPG ou WebP
          até 8 MB. Mantenha o assunto principal (brasão, texto) no centro: nas telas estreitas as bordas podem ser cortadas.
          Sem imagem, o card fica só com o texto.
        </p>
        {values.cardImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={values.cardImageUrl} alt="Imagem atual do card" width={240} height={135} style={{ borderRadius: 10, objectFit: "cover" }} />
        ) : null}
        <input name="cardImage" type="file" accept="image/png,image/jpeg,image/webp" />
        {values.cardImageUrl ? (
          <label>
            <input type="checkbox" name="removeCardImage" /> Remover a imagem
          </label>
        ) : null}
      </fieldset>
      <label className={styles.field}>
        <span>
          Banner da página inicial (largo, ex.: 1600×530; PNG, JPG ou WebP até 8 MB)
          {values.hasBanner ? " — já tem; envie outro para trocar" : ""}
        </span>
        <input name="banner" type="file" accept="image/png,image/jpeg,image/webp" />
      </label>
      {values.hasBanner ? (
        <div className={styles.checks}>
          <label>
            <input type="checkbox" name="removeBanner" /> Remover o banner
          </label>
        </div>
      ) : (
        <p className={styles.hint}>Sem banner, o carrossel da página inicial monta o slide com o nome, a chamada e o preço.</p>
      )}
      <label className={`${styles.field} ${styles.full}`}>
        <span>Descrição (o que está incluído; aceita **negrito** e quebras de linha)</span>
        <textarea name="description" defaultValue={values.description} rows={8} maxLength={20000} />
      </label>
      <p className={`${styles.hint} ${styles.full}`}>
        A oferta precisa dar Premium, cursos ou os dois. Mudar a oferta não altera o acesso de quem já comprou.
      </p>
      <div className={styles.full}>
        <button type="submit" className={styles.primary}>
          {values.id ? "Salvar oferta" : "Criar oferta"}
        </button>
      </div>
    </form>
  );
}

/** Stored end instant (00:00 next day, São Paulo) → last promo day for the date input. */
function promoLastDayValue(end: Date | null): string {
  if (!end) return "";
  return new Date(end.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
