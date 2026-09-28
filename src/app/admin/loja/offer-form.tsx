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
  premiumDays: number | null | "none";
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}>;

const cents = (value: number | null) => (value === null ? "" : formatBRL(value).replace(/R\$\s?/, ""));

/** Server-rendered offer form (create and edit). */
export function OfferForm({ values }: Readonly<{ values: OfferFormValues }>) {
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
        <span>Dias de Premium (0 = sem prazo)</span>
        <input name="premiumDays" type="number" min={0} max={3660} defaultValue={premiumDays} required placeholder="180" />
      </label>
      <div className={styles.checks}>
        <label>
          <input type="checkbox" name="isActive" defaultChecked={values.isActive} /> À venda (aparece na Loja)
        </label>
        <label>
          <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} /> Destaque
        </label>
      </div>
      <label className={`${styles.field} ${styles.full}`}>
        <span>Descrição (o que está incluído; aceita **negrito** e quebras de linha)</span>
        <textarea name="description" defaultValue={values.description} rows={8} maxLength={20000} />
      </label>
      <p className={`${styles.hint} ${styles.full}`}>
        Cursos e materiais entram nas ofertas na Fase 3 (área de membros). Mudar a oferta não altera o acesso de quem já
        comprou.
      </p>
      <div className={styles.full}>
        <button type="submit" className={styles.primary}>
          {values.id ? "Salvar oferta" : "Criar oferta"}
        </button>
      </div>
    </form>
  );
}
