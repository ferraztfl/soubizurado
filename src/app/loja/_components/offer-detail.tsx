import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { withEffectivePrice } from "@/modules/store/domain/offer-price";
import { formatBRL } from "@/modules/store/domain/store";
import { loadOfferOwnership } from "@/modules/store/infrastructure/offer-ownership";
import { checkoutAction, checkoutNewAccountAction } from "@/modules/store/presentation/checkout-actions";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { RichText } from "@/shared/ui/rich-text";

import styles from "../loja.module.css";

const PROMO_DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

const ERRORS: Readonly<Record<string, string>> = {
  termos: "Para continuar, aceite os Termos de uso e a Política de privacidade.",
  dados: "Confira os dados: nome com 2 letras ou mais, e-mail válido e senha com 8 a 128 caracteres.",
  "conta-existe": "Já existe uma conta com este e-mail. Entre na sua conta para comprar.",
  sessao: "Sua sessão expirou. Entre novamente para comprar.",
  indisponivel: "Esta oferta não está mais disponível.",
  pagamento: "Não foi possível abrir o pagamento agora. Tente novamente em instantes.",
  configuracao: "A loja ainda está sendo configurada. Tente novamente mais tarde.",
};

export const loadOffer = cache(async (slug: string) =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
    ? getPrismaClient().offer.findFirst({
        where: { slug, isActive: true },
        select: {
          slug: true,
          name: true,
          headline: true,
          description: true,
          priceCents: true,
          compareAtCents: true,
          promoEndsAt: true,
          grants: { select: { kind: true, durationDays: true, courseId: true, course: { select: { title: true } } } },
        },
      }).then((offer) => (offer ? withEffectivePrice(offer, new Date()) : null))
    : null,
);

/** Offer detail with the buy box, shared by /loja/[slug] and /app/loja/[slug]. */
export async function OfferDetail({ slug, erro, basePath }: Readonly<{ slug: string; erro?: string; basePath: "/loja" | "/app/loja" }>) {
  const offer = await loadOffer(slug);

  if (!offer) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profileId = user ? await findStudentProfileId(user.id) : null;
  const owned = profileId ? (await loadOfferOwnership(profileId, [{ slug: offer.slug, grants: offer.grants }])).get(offer.slug) : undefined;
  const premium = offer.grants.find((grant) => grant.kind === "QUESTION_BANK");
  const allCourses = offer.grants.some((grant) => grant.kind === "ALL_COURSES");
  const courses = offer.grants.flatMap((grant) => (grant.kind === "COURSE" && grant.course ? [grant.course.title] : []));

  const terms = (
    <label className={styles.terms}>
      <input type="checkbox" name="acceptTerms" required />
      <span>
        Li e aceito os <Link href="/termos">Termos de uso</Link> e a <Link href="/privacidade">Política de privacidade</Link>.
        Você tem 7 dias para desistir da compra com reembolso integral.
      </span>
    </label>
  );

  return (
    <div className={styles.detail}>
      <article className={styles.detailBody}>
        <Link href={basePath} className={styles.backLink}>
          ← Voltar para a Loja
        </Link>
        <h1>{offer.name}</h1>
        {offer.headline ? <p className={styles.headline}>{offer.headline}</p> : null}
        <ul className={styles.benefits}>
          {courses.map((title) => (
            <li key={title}>{title}: todas as matérias do edital, com grifo, anotações, áudio e questões por assunto</li>
          ))}
          {allCourses ? <li>Todos os cursos Teoria Completa do site (PMPE, CBMPE e os próximos editais), pelo mesmo prazo do Premium</li> : null}
          {premium ? (
            <>
              <li>
                {premium.durationDays === null
                  ? "Premium sem prazo de validade"
                  : `Premium por ${premium.durationDays} dias (soma ao tempo que você já tiver)`}
              </li>
              <li>Questões e simulados ilimitados</li>
              <li>Revisão espaçada dos seus erros, missões e ranking</li>
            </>
          ) : null}
        </ul>
        {offer.description ? (
          <div className={styles.descriptionText}>
            <RichText text={offer.description} />
          </div>
        ) : null}
      </article>

      <aside className={styles.buyBox} aria-label="Comprar">
        <div className={styles.price}>
          {offer.compareAtCents ? <s>{formatBRL(offer.compareAtCents)}</s> : null}
          <strong>{formatBRL(offer.priceCents)}</strong>
        </div>
        {offer.promoActive && offer.promoEndsAt ? (
          <p className={styles.payHint}>
            Promoção válida até {PROMO_DATE.format(new Date(offer.promoEndsAt.getTime() - 1))}. Depois, {offer.compareAtCents ? formatBRL(offer.compareAtCents) : "preço cheio"}.
          </p>
        ) : null}
        <p className={styles.payHint}>Pix, cartão de crédito ou boleto — pagamento processado pelo Mercado Pago.</p>

        {erro && ERRORS[erro] ? (
          <p className={styles.error} role="alert">
            {ERRORS[erro]}
            {erro === "conta-existe" || erro === "sessao" ? (
              <>
                {" "}
                <Link href="/login">Entrar</Link>
              </>
            ) : null}
          </p>
        ) : null}

        {owned ? (
          <div className={styles.checkoutForm}>
            <p className={styles.owned}>
              {owned.admin ? "✓ Já incluído no seu acesso de administrador" : "✓ Você já tem este combo"}
              {owned.admin ? "" : owned.endsAt ? ` — acesso até ${PROMO_DATE.format(owned.endsAt)}` : " — sem prazo de validade"}
            </p>
            <p className={styles.payHint}>
              {owned.admin ? "Contas de administrador não precisam comprar nada." : "Quando o prazo terminar, ele volta a ficar disponível para compra aqui."}
            </p>
            <Link href="/app/cursos" className={styles.secondaryBuy}>
              Ir para meus cursos
            </Link>
          </div>
        ) : user ? (
          <form action={checkoutAction} className={styles.checkoutForm}>
            <input type="hidden" name="offer" value={offer.slug} />
            <p className={styles.payHint}>
              Comprando como <strong>{user.email}</strong>
            </p>
            {terms}
            <button type="submit" className={styles.buy}>
              Comprar agora
            </button>
          </form>
        ) : (
          <form action={checkoutNewAccountAction} className={styles.checkoutForm}>
            <input type="hidden" name="offer" value={offer.slug} />
            <p className={styles.payHint}>
              Crie sua conta para comprar. Já tem conta? <Link href="/login">Entre</Link> e volte aqui.
            </p>
            <label className={styles.field}>
              <span>Nome</span>
              <input name="displayName" required minLength={2} maxLength={120} autoComplete="name" />
            </label>
            <label className={styles.field}>
              <span>E-mail</span>
              <input name="email" type="email" required maxLength={254} autoComplete="email" />
            </label>
            <label className={styles.field}>
              <span>Senha (mínimo 8 caracteres)</span>
              <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
            </label>
            {terms}
            <button type="submit" className={styles.buy}>
              Criar conta e pagar
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
