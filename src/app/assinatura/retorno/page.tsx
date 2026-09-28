import type { Metadata } from "next";
import Link from "next/link";

import { refreshMercadoPagoSubscription } from "@/modules/store/infrastructure/process-subscription";

import { loadSiteViewer } from "../../_components/site-viewer";
import styles from "../assinatura.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Assinatura", robots: { index: false } };

type ReturnPageProps = Readonly<{ searchParams: Promise<Readonly<{ preapproval_id?: string }>> }>;

/** Back from Mercado Pago: reads the subscription from the API (never from the URL) and shows where it stands. */
export default async function SubscriptionReturnPage({ searchParams }: ReturnPageProps) {
  const { preapproval_id: preapprovalId } = await searchParams;
  let status: string | null = null;

  if (preapprovalId && /^[0-9a-zA-Z_-]{6,80}$/.test(preapprovalId)) {
    try {
      const result = await refreshMercadoPagoSubscription(preapprovalId);
      status = result.kind === "UPDATED" ? result.status : null;
    } catch {
      status = null;
    }
  }

  // Premium is on only after an approved charge (checked from the entitlements).
  const viewer = await loadSiteViewer();

  return (
    <div className={styles.page}>
      <section className={styles.status}>
        {viewer.premium ? (
          <>
            <span className={styles.eyebrow}>Tudo certo</span>
            <h1>Bem-vindo ao Premium!</h1>
            <p>Sua assinatura está ativa: questões e simulados ilimitados a partir de agora.</p>
            <div className={styles.statusActions}>
              <Link href="/questoes" className={styles.primary}>
                Resolver questões
              </Link>
              <Link href="/app/assinatura" className={styles.secondary}>
                Ver minha assinatura
              </Link>
            </div>
          </>
        ) : status === "CANCELLED" ? (
          <>
            <h1>Assinatura não concluída</h1>
            <p>O pagamento foi cancelado. Você pode tentar de novo quando quiser.</p>
            <div className={styles.statusActions}>
              <Link href="/assinatura" className={styles.primary}>
                Tentar novamente
              </Link>
            </div>
          </>
        ) : (
          <>
            <span className={styles.eyebrow}>Quase lá</span>
            <h1>Estamos confirmando seu pagamento</h1>
            <p>
              Assim que o Mercado Pago aprovar a primeira cobrança, o Premium é liberado automaticamente — em geral, em poucos
              minutos. Você pode acompanhar em Minha área → Assinatura.
            </p>
            <div className={styles.statusActions}>
              <Link href="/app/assinatura" className={styles.primary}>
                Acompanhar assinatura
              </Link>
              <Link href="/questoes" className={styles.secondary}>
                Resolver questões
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
