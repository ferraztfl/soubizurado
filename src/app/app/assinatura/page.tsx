import Link from "next/link";
import { redirect } from "next/navigation";

import { formatBRL } from "@/modules/store/domain/store";
import { monthlyPriceLabel } from "@/modules/store/domain/subscription";
import { cancelSubscriptionAction } from "@/modules/store/presentation/subscription-actions";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "../compras/compras.module.css";

export const dynamic = "force-dynamic";

type MySubscriptionPageProps = Readonly<{ searchParams: Promise<Readonly<{ ok?: string; erro?: string }>> }>;

const STATUS: Readonly<Record<string, { label: string; tone: string }>> = {
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

const ERRORS: Readonly<Record<string, string>> = {
  confirmacao: "Marque a confirmação para cancelar.",
  assinatura: "Assinatura não encontrada.",
  cancelamento: "Não foi possível cancelar agora no Mercado Pago. Tente novamente em instantes.",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function MySubscriptionPage({ searchParams }: MySubscriptionPageProps) {
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

  const [subscriptions, premium] = profileId
    ? await Promise.all([
        prisma.subscription.findMany({
          where: { profileId, OR: [{ status: { not: "PENDING" } }, { payments: { some: {} } }] },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            amountCents: true,
            nextChargeAt: true,
            cancelledAt: true,
            createdAt: true,
            payments: { orderBy: { createdAt: "desc" }, take: 24, select: { id: true, status: true, amountCents: true, paidAt: true, createdAt: true } },
          },
        }),
        prisma.entitlement.findFirst({
          where: { profileId, kind: "QUESTION_BANK", revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          orderBy: { endsAt: { sort: "desc", nulls: "first" } },
          select: { endsAt: true },
        }),
      ])
    : [[], null];

  const current = subscriptions.find((row) => row.status === "AUTHORIZED" || row.status === "PAUSED") ?? subscriptions[0] ?? null;

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Conta" title="Minha assinatura" description="Seu Premium mensal, as cobranças e o cancelamento." />

      {params.ok === "cancelada" ? (
        <p className={styles.accessOff}>
          <strong>Assinatura cancelada.</strong>
          <span>Não haverá novas cobranças. Seu Premium continua até o fim do período já pago.</span>
        </p>
      ) : null}
      {params.erro && ERRORS[params.erro] ? <p className={styles.accessOff}>{ERRORS[params.erro]}</p> : null}

      <section className={premium ? styles.accessOn : styles.accessOff}>
        <strong>
          {premium ? (premium.endsAt ? `Premium até ${dateFormatter.format(premium.endsAt)}` : "Premium sem prazo") : "Plano gratuito"}
        </strong>
        <span>
          {current?.status === "AUTHORIZED"
            ? `Renovação automática de ${formatBRL(current.amountCents)} por mês${current.nextChargeAt ? ` — próxima cobrança em ${dateFormatter.format(current.nextChargeAt)}` : ""}.`
            : premium
              ? "Sem renovação automática."
              : "Assine para ter questões e simulados ilimitados."}
        </span>
        {current?.status === "AUTHORIZED" ? null : (
          <Link href="/assinatura" className={styles.link}>
            Assinar por {monthlyPriceLabel()}
          </Link>
        )}
      </section>

      {current ? (
        <section className={styles.card}>
          <h2>Assinatura</h2>
          <ul className={styles.list}>
            <li>
              <div>
                <strong>Premium mensal · {formatBRL(current.amountCents)}/mês</strong>
                <span>
                  Assinada em {dateFormatter.format(current.createdAt)}
                  {current.cancelledAt ? ` · cancelada em ${dateFormatter.format(current.cancelledAt)}` : ""}
                </span>
              </div>
              <span className={styles[`status_${(STATUS[current.status] ?? STATUS.PENDING).tone}`]}>
                {(STATUS[current.status] ?? STATUS.PENDING).label}
              </span>
            </li>
            {current.payments.map((payment) => {
              const status = CHARGE_STATUS[payment.status] ?? CHARGE_STATUS.PENDING;
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
            <form action={cancelSubscriptionAction} className={styles.list}>
              <input type="hidden" name="subscriptionId" value={current.id} />
              <label className={styles.muted}>
                <input type="checkbox" name="confirm" required /> Quero cancelar a renovação automática (o Premium já pago continua até o fim
                do período).
              </label>
              <button type="submit" className={styles.link}>
                Cancelar assinatura
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <p className={styles.muted}>
        Arrependeu-se? Você pode desistir em até 7 dias da contratação e receber o valor de volta, pelo nosso contato.
      </p>
    </div>
  );
}
