import Link from "next/link";
import { redirect } from "next/navigation";

import { allCoursesAccessEnd, isAdminProfile } from "@/modules/courses/infrastructure/course-access";
import { describePlan } from "@/modules/store/domain/plan-summary";
import { formatBRL } from "@/modules/store/domain/store";
import { monthlyPriceLabel } from "@/modules/store/domain/subscription";
import { cancelSubscriptionAction } from "@/modules/store/presentation/subscription-actions";
import { FREE_DAILY_ANSWERS } from "@/modules/study/domain/access";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";

import styles from "./assinatura.module.css";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{ searchParams: Promise<Readonly<{ ok?: string; erro?: string }>> }>;

const SUBSCRIPTION_STATUS: Readonly<Record<string, { label: string; tone: string }>> = {
  PENDING: { label: "Aguardando pagamento", tone: "pending" },
  AUTHORIZED: { label: "Ativa", tone: "paid" },
  PAUSED: { label: "Pausada", tone: "pending" },
  CANCELLED: { label: "Cancelada", tone: "off" },
};

const CHARGE_STATUS: Readonly<Record<string, { label: string; tone: string }>> = {
  PENDING: { label: "Processando", tone: "pending" },
  PAID: { label: "Pago", tone: "paid" },
  FAILED: { label: "Não aprovado", tone: "off" },
  REFUNDED: { label: "Estornado", tone: "off" },
};

const ORDER_STATUS: Readonly<Record<string, { label: string; tone: string }>> = {
  PENDING: { label: "Aguardando pagamento", tone: "pending" },
  PAID: { label: "Pago", tone: "paid" },
  FAILED: { label: "Não aprovado", tone: "off" },
  CANCELLED: { label: "Cancelado", tone: "off" },
  REFUNDED: { label: "Estornado", tone: "off" },
};

const ERRORS: Readonly<Record<string, string>> = {
  confirmacao: "Marque a confirmação para cancelar.",
  assinatura: "Assinatura não encontrada.",
  cancelamento: "Não foi possível cancelar agora no Mercado Pago. Tente novamente em instantes.",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

/** One place for the plan, the monthly subscription, the courses the student has and the orders. */
export default async function AccountPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app/assinatura");
  }

  const params = await searchParams;
  const profileId = await findStudentProfileId(user.id);
  const prisma = getPrismaClient();
  const now = new Date();
  const active = { revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };

  const [isAdmin, allCoursesEnds, questionBank, courseAccess, subscriptions, orders] = profileId
    ? await Promise.all([
        isAdminProfile(profileId),
        allCoursesAccessEnd(profileId, now),
        prisma.entitlement.findMany({ where: { profileId, kind: "QUESTION_BANK", ...active }, select: { endsAt: true } }),
        prisma.entitlement.findMany({
          where: { profileId, kind: "COURSE", ...active },
          orderBy: { createdAt: "desc" },
          select: { endsAt: true, course: { select: { slug: true, title: true } } },
        }),
        prisma.subscription.findMany({
          where: { profileId, OR: [{ status: { not: "PENDING" } }, { payments: { some: {} } }] },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            amountCents: true,
            nextChargeAt: true,
            cancelledAt: true,
            createdAt: true,
            payments: { orderBy: { createdAt: "desc" }, take: 12, select: { id: true, status: true, amountCents: true, paidAt: true, createdAt: true } },
          },
        }),
        prisma.order.findMany({
          where: { profileId },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { id: true, status: true, amountCents: true, createdAt: true, paidAt: true, offer: { select: { name: true } } },
        }),
      ])
    : ([false, undefined, [], [], [], []] as const);

  const questionBankEnds =
    questionBank.length === 0
      ? undefined
      : questionBank.some((row) => row.endsAt === null)
        ? null
        : questionBank.reduce((latest, row) => (row.endsAt! > latest ? row.endsAt! : latest), questionBank[0]!.endsAt!);
  const current = subscriptions.find((row) => row.status === "AUTHORIZED" || row.status === "PAUSED") ?? subscriptions[0] ?? null;
  const plan = describePlan({
    isAdmin,
    questionBankEnds,
    allCoursesEnds,
    subscriptionStatus: current?.status ?? null,
    nextChargeAt: current?.nextChargeAt ?? null,
    dailyFreeAnswers: FREE_DAILY_ANSWERS.free,
  });
  const premiumLike = plan.tier !== "FREE";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Conta</span>
        <h1>Assinatura e compras</h1>
        <p>Seu plano, os cursos que você tem, a renovação e o histórico de pedidos — tudo em um só lugar.</p>
      </header>

      {params.ok === "cancelada" ? (
        <p className={styles.notice} role="status">
          <strong>Assinatura cancelada.</strong> Não haverá novas cobranças. Seu Premium continua até o fim do período já pago.
        </p>
      ) : null}
      {params.erro && ERRORS[params.erro] ? (
        <p className={styles.noticeError} role="alert">
          {ERRORS[params.erro]}
        </p>
      ) : null}

      <section className={`${styles.plan} ${premiumLike ? styles.planOn : ""}`}>
        <div className={styles.planMain}>
          <span className={styles.badge}>{plan.badge}</span>
          <h2>{plan.title}</h2>
          <p>{plan.detail}</p>
          {plan.tier === "FREE" ? (
            <Link href="/app/loja" className={styles.primary}>
              Ver planos e combos
            </Link>
          ) : plan.tier === "PREMIUM" && current?.status !== "AUTHORIZED" ? (
            <Link href="/app/loja" className={styles.secondary}>
              Ver a Loja
            </Link>
          ) : null}
        </div>

        <dl className={styles.facts}>
          <div>
            <dt>Questões e simulados</dt>
            <dd>{plan.questions}</dd>
          </div>
          <div>
            <dt>Cursos</dt>
            <dd>{plan.courses}</dd>
          </div>
          <div>
            <dt>Renovação</dt>
            <dd>{plan.renewal}</dd>
          </div>
        </dl>
      </section>

      {plan.tier === "FREE" ? (
        <section className={styles.card}>
          <h2>Premium mensal</h2>
          <p className={styles.muted}>
            Questões e simulados ilimitados, todos os cursos e revisão dos seus erros por {monthlyPriceLabel()}, com renovação automática. Cancele quando quiser.
          </p>
          <Link href="/assinatura" className={styles.primary}>
            Assinar por {monthlyPriceLabel()}
          </Link>
        </section>
      ) : null}

      {current ? (
        <section className={styles.card}>
          <h2>Assinatura mensal</h2>
          <ul className={styles.list}>
            <li>
              <div>
                <strong>Premium mensal · {formatBRL(current.amountCents)}/mês</strong>
                <span>
                  Assinada em {dateFormatter.format(current.createdAt)}
                  {current.cancelledAt ? ` · cancelada em ${dateFormatter.format(current.cancelledAt)}` : ""}
                </span>
              </div>
              <span className={styles[`status_${(SUBSCRIPTION_STATUS[current.status] ?? SUBSCRIPTION_STATUS.PENDING!).tone}`]}>
                {(SUBSCRIPTION_STATUS[current.status] ?? SUBSCRIPTION_STATUS.PENDING!).label}
              </span>
            </li>
            {current.payments.map((payment) => {
              const status = CHARGE_STATUS[payment.status] ?? CHARGE_STATUS.PENDING!;

              return (
                <li key={payment.id}>
                  <div>
                    <strong>Cobrança de {formatBRL(payment.amountCents)}</strong>
                    <span>{dateFormatter.format(payment.paidAt ?? payment.createdAt)}</span>
                  </div>
                  <span className={styles[`status_${status.tone}`]}>{status.label}</span>
                </li>
              );
            })}
          </ul>

          {current.status === "AUTHORIZED" || current.status === "PAUSED" ? (
            <form action={cancelSubscriptionAction} className={styles.cancel}>
              <input type="hidden" name="subscriptionId" value={current.id} />
              <label>
                <input type="checkbox" name="confirm" required /> Quero cancelar a renovação automática (o Premium já pago continua até o fim do período).
              </label>
              <button type="submit" className={styles.danger}>
                Cancelar assinatura
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {courseAccess.length > 0 && allCoursesEnds === undefined && !isAdmin ? (
        <section className={styles.card}>
          <h2>Cursos que você tem</h2>
          <ul className={styles.list}>
            {courseAccess.map((row) =>
              row.course ? (
                <li key={row.course.slug}>
                  <div>
                    <strong>{row.course.title}</strong>
                    <span>{row.endsAt ? `Acesso até ${dateFormatter.format(row.endsAt)}` : "Acesso sem prazo"}</span>
                  </div>
                  <Link href={`/app/cursos/${row.course.slug}`} className={styles.link}>
                    Abrir
                  </Link>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      <section className={styles.card}>
        <h2>Pedidos</h2>
        {orders.length === 0 ? (
          <p className={styles.muted}>Você ainda não fez nenhuma compra.</p>
        ) : (
          <ul className={styles.list}>
            {orders.map((order) => {
              const status = ORDER_STATUS[order.status] ?? { label: order.status, tone: "off" };

              return (
                <li key={order.id}>
                  <div>
                    <strong>{order.offer.name}</strong>
                    <span>
                      {formatBRL(order.amountCents)} · pedido em {dateFormatter.format(order.createdAt)}
                      {order.paidAt ? ` · pago em ${dateFormatter.format(order.paidAt)}` : ""}
                    </span>
                  </div>
                  <span className={styles[`status_${status.tone}`]}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className={styles.muted}>
        Arrependeu-se? Você pode desistir em até 7 dias da contratação ou da compra e receber o valor de volta, pelo nosso contato.
      </p>
    </div>
  );
}
