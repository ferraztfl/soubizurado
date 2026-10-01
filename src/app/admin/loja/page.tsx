import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { formatBRL } from "@/modules/store/domain/store";
import { isMercadoPagoConfigured } from "@/modules/store/infrastructure/mercado-pago/mercado-pago-client";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { recheckPaymentAction } from "./actions";
import styles from "./loja.module.css";
import { OfferForm } from "./offer-form";

export const dynamic = "force-dynamic";

type StorePageProps = Readonly<{
  searchParams: Promise<Readonly<{ error?: string; info?: string }>>;
}>;

const STATUS_LABEL: Readonly<Record<string, string>> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  FAILED: "Recusado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AdminStorePage(props: StorePageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const prisma = getPrismaClient();
  const [offers, orders, paid, courses] = await Promise.all([
    prisma.offer.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        priceCents: true,
        isActive: true,
        isFeatured: true,
        grants: { select: { kind: true, durationDays: true } },
        _count: { select: { orders: { where: { status: "PAID" } } } },
      },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        status: true,
        amountCents: true,
        providerPaymentId: true,
        createdAt: true,
        offer: { select: { name: true } },
        profile: { select: { displayName: true } },
      },
    }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.course.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true } }),
  ]);

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Operação</p>
        <h1 className={styles.title}>Loja</h1>
        <p className={styles.description}>
          Ofertas vendidas pelo Mercado Pago (Checkout Pro). O acesso só é liberado quando o Mercado Pago confirma o
          pagamento.
        </p>
      </header>

      {!isMercadoPagoConfigured() ? (
        <p className={styles.warning}>
          Mercado Pago ainda não configurado: coloque <code>MERCADOPAGO_ACCESS_TOKEN</code> (credencial de teste
          primeiro) e <code>MERCADOPAGO_WEBHOOK_SECRET</code> no <code>.env</code> e reinicie o servidor.
        </p>
      ) : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}
      {params.info ? <p className={styles.info}>{params.info.slice(0, 300)}</p> : null}

      <section className={styles.cards}>
        <div>
          <strong>{paid._count._all}</strong>
          <span>pedidos pagos</span>
        </div>
        <div>
          <strong>{formatBRL(paid._sum.amountCents ?? 0)}</strong>
          <span>faturado (bruto)</span>
        </div>
        <div>
          <strong>{offers.filter((offer) => offer.isActive).length}</strong>
          <span>ofertas à venda</span>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Ofertas</h2>
        {offers.length === 0 ? (
          <p className={styles.hint}>Nenhuma oferta ainda. Crie a primeira abaixo.</p>
        ) : (
          <ul className={styles.list}>
            {offers.map((offer) => {
              const premium = offer.grants.find((grant) => grant.kind === "QUESTION_BANK");
              const days = premium?.durationDays;
              const courseCount = offer.grants.filter((grant) => grant.kind === "COURSE").length;
              return (
                <li key={offer.id}>
                  <div>
                    <strong>{offer.name}</strong>
                    <span>
                      {formatBRL(offer.priceCents)} · {premium ? `Premium ${days === null || days === undefined ? "sem prazo" : `${days} dias`}` : "sem Premium"}
                      {offer.grants.some((grant) => grant.kind === "ALL_COURSES") ? " + todos os cursos" : courseCount > 0 ? ` + ${courseCount} curso(s)` : ""} ·{" "}
                      {offer._count.orders} vendidas · /loja/{offer.slug}
                    </span>
                  </div>
                  <div className={styles.row}>
                    <span className={offer.isActive ? styles.badgeOn : styles.badgeOff}>{offer.isActive ? "À venda" : "Pausada"}</span>
                    {offer.isFeatured ? <span className={styles.badgeOn}>Destaque</span> : null}
                    <Link href={`/admin/loja/${offer.id}`}>Editar</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2>Nova oferta</h2>
        <OfferForm
          values={{
            id: null,
            name: "",
            slug: "",
            headline: "",
            description: "",
            priceCents: null,
            compareAtCents: null,
            promoEndsAt: null,
            premiumDays: "none",
            allCourses: false,
            isActive: false,
            isFeatured: false,
            sortOrder: 0,
            courseIds: [],
            courseDays: null,
            hasBanner: false,
          }}
          courses={courses}
        />
      </section>

      <section className={styles.card}>
        <h2>Pedidos recentes</h2>
        {orders.length === 0 ? (
          <p className={styles.hint}>Nenhum pedido ainda.</p>
        ) : (
          <ul className={styles.list}>
            {orders.map((order) => (
              <li key={order.id}>
                <div>
                  <strong>{order.offer.name}</strong>
                  <span>
                    {order.profile.displayName ?? "Aluno"} · {formatBRL(order.amountCents)} · {dateFormatter.format(order.createdAt)}
                    {order.providerPaymentId ? ` · pagamento ${order.providerPaymentId}` : ""}
                  </span>
                </div>
                <span className={order.status === "PAID" ? styles.badgeOn : styles.badgeOff}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form action={recheckPaymentAction} className={styles.recheck}>
          <label className={styles.field}>
            <span>Conferir um pagamento pelo número do Mercado Pago (se o webhook não chegou)</span>
            <input name="paymentId" inputMode="numeric" pattern="[0-9]{1,20}" placeholder="Ex.: 1234567890" required />
          </label>
          <button type="submit" className={styles.secondary}>
            Conferir pagamento
          </button>
        </form>
      </section>
    </main>
  );
}
