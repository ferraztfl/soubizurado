import type { Metadata } from "next";
import Link from "next/link";

import { processMercadoPagoPayment } from "@/modules/store/infrastructure/process-payment";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../loja.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

type ReturnPageProps = Readonly<{
  searchParams: Promise<Readonly<{ payment_id?: string; collection_id?: string; external_reference?: string }>>;
}>;

/**
 * Mercado Pago sends the buyer back here. The query string is only used to
 * know which payment to check: the payment is re-read from the API (the same
 * idempotent processing as the webhook, so it also works without a public
 * webhook URL, e.g. on localhost).
 */
export default async function PaymentReturnPage(props: ReturnPageProps) {
  const params = await props.searchParams;
  const paymentId = params.payment_id ?? params.collection_id ?? "";
  const orderId = params.external_reference ?? "";

  if (/^\d{1,20}$/.test(paymentId)) {
    await processMercadoPagoPayment(paymentId).catch(() => null);
  }

  // The order id is an unguessable UUID; only its status and offer name are shown.
  const order = /^[0-9a-f-]{36}$/i.test(orderId)
    ? await getPrismaClient().order.findUnique({ where: { id: orderId }, select: { status: true, offer: { select: { name: true } } } })
    : null;

  const status = order?.status ?? "UNKNOWN";

  return (
    <div className={styles.returnBox}>
      {status === "PAID" ? (
        <>
          <span className={styles.bigIcon} aria-hidden="true">
            ✓
          </span>
          <h1>Pagamento aprovado!</h1>
          <p>
            <strong>{order?.offer.name}</strong> já está ativo na sua conta. Bons estudos!
          </p>
          <p className={styles.payHint}>
            Criou a conta agora? Confirme seu e-mail pelo link que enviamos e depois entre com sua senha.
          </p>
          <Link href="/app/estudar" className={styles.buy}>
            Começar a estudar
          </Link>
        </>
      ) : status === "PENDING" ? (
        <>
          <span className={styles.bigIcon} aria-hidden="true">
            ⏳
          </span>
          <h1>Pagamento em processamento</h1>
          <p>Pix e boleto podem levar alguns minutos (boleto: até 3 dias úteis). Liberamos seu acesso assim que o Mercado Pago confirmar.</p>
          <Link href="/app/compras" className={styles.buy}>
            Acompanhar minhas compras
          </Link>
        </>
      ) : status === "FAILED" || status === "CANCELLED" ? (
        <>
          <span className={styles.bigIcon} aria-hidden="true">
            ✕
          </span>
          <h1>Pagamento não aprovado</h1>
          <p>Nenhuma cobrança foi feita. Você pode tentar novamente com outro meio de pagamento.</p>
          <Link href="/loja" className={styles.buy}>
            Voltar para a Loja
          </Link>
        </>
      ) : (
        <>
          <h1>Não encontramos este pagamento</h1>
          <p>Se você pagou, o acesso é liberado automaticamente em instantes. Veja em Minhas compras.</p>
          <Link href="/app/compras" className={styles.buy}>
            Minhas compras
          </Link>
        </>
      )}
    </div>
  );
}
