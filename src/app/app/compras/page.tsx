import Link from "next/link";
import { redirect } from "next/navigation";

import { formatBRL } from "@/modules/store/domain/store";
import { findStudentProfileId } from "@/modules/study/infrastructure/queries/answered-question-status";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import { PageHeader } from "@/shared/ui/page-header";

import styles from "./compras.module.css";

export const dynamic = "force-dynamic";

const STATUS: Readonly<Record<string, { label: string; tone: string }>> = {
  PENDING: { label: "Aguardando pagamento", tone: "pending" },
  PAID: { label: "Pago", tone: "paid" },
  FAILED: { label: "Não aprovado", tone: "off" },
  CANCELLED: { label: "Cancelado", tone: "off" },
  REFUNDED: { label: "Estornado", tone: "off" },
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function PurchasesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileId = await findStudentProfileId(user.id);
  const prisma = getPrismaClient();
  const now = new Date();
  const [orders, access] = profileId
    ? await Promise.all([
        prisma.order.findMany({
          where: { profileId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, status: true, amountCents: true, createdAt: true, paidAt: true, offer: { select: { name: true, slug: true } } },
        }),
        prisma.entitlement.findMany({
          where: { profileId, kind: "QUESTION_BANK", revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          select: { startsAt: true, endsAt: true },
        }),
      ])
    : [[], []];

  const unlimited = access.some((row) => row.endsAt === null);
  const until = access.reduce<Date | null>((latest, row) => (row.endsAt && (!latest || row.endsAt > latest) ? row.endsAt : latest), null);

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Conta" title="Minhas compras" description="Seus pedidos e a validade do seu acesso Premium." />

      <section className={access.length > 0 ? styles.accessOn : styles.accessOff}>
        <strong>
          {access.length === 0 ? "Plano gratuito" : unlimited ? "Premium sem prazo" : `Premium até ${dateFormatter.format(until!)}`}
        </strong>
        <span>
          {access.length === 0
            ? "10 respostas grátis por dia. Com o Premium, questões e simulados são ilimitados."
            : "Compras novas somam tempo ao seu Premium."}
        </span>
        <Link href={access.length === 0 ? "/assinatura" : "/app/loja"} className={styles.link}>
          {access.length === 0 ? "Conhecer os planos" : "Ver a Loja"}
        </Link>
      </section>

      <section className={styles.card}>
        <h2>Pedidos</h2>
        {orders.length === 0 ? (
          <p className={styles.muted}>Você ainda não fez nenhuma compra.</p>
        ) : (
          <ul className={styles.list}>
            {orders.map((order) => {
              const status = STATUS[order.status] ?? { label: order.status, tone: "off" };
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
        <p className={styles.muted}>
          Arrependeu-se? Você pode pedir o reembolso em até 7 dias após a compra pelo nosso contato.
        </p>
      </section>
    </div>
  );
}
