/*
 * Minimal Mercado Pago REST client (Checkout Pro). Server-only: uses the
 * access token from MERCADOPAGO_ACCESS_TOKEN (test or production
 * credentials, set by the owner in .env). No card data ever reaches us —
 * the buyer pays on Mercado Pago's page.
 */

const API = "https://api.mercadopago.com";

export class MercadoPagoNotConfiguredError extends Error {
  public constructor() {
    super("Mercado Pago is not configured (MERCADOPAGO_ACCESS_TOKEN).");
  }
}

function accessToken(): string {
  if (typeof window !== "undefined") {
    throw new Error("The Mercado Pago client must never run in the browser.");
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new MercadoPagoNotConfiguredError();

  return token;
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

async function request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Mercado Pago ${init.method ?? "GET"} ${path} failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export type CreatePreferenceInput = Readonly<{
  orderId: string;
  title: string;
  description: string | null;
  priceCents: number;
  payerEmail: string | null;
  payerName: string | null;
  siteUrl: string;
}>;

export type Preference = Readonly<{ id: string; init_point: string; sandbox_init_point?: string }>;

/** Checkout Pro preference: the buyer pays on Mercado Pago and comes back to /loja/retorno. */
export async function createPreference(input: CreatePreferenceInput): Promise<Preference> {
  const back = `${input.siteUrl}/loja/retorno`;
  const isPublicUrl = /^https:\/\//.test(input.siteUrl);

  return request<Preference>("/checkout/preferences", {
    method: "POST",
    idempotencyKey: `preference-${input.orderId}`,
    body: JSON.stringify({
      items: [
        {
          id: input.orderId,
          title: input.title.slice(0, 250),
          ...(input.description ? { description: input.description.slice(0, 250) } : {}),
          quantity: 1,
          currency_id: "BRL",
          unit_price: input.priceCents / 100,
        },
      ],
      ...(input.payerEmail ? { payer: { email: input.payerEmail, ...(input.payerName ? { name: input.payerName } : {}) } } : {}),
      external_reference: input.orderId,
      metadata: { order_id: input.orderId },
      back_urls: { success: back, failure: back, pending: back },
      // Mercado Pago only redirects automatically / notifies public HTTPS URLs.
      ...(isPublicUrl
        ? { auto_return: "approved", notification_url: `${input.siteUrl}/api/webhooks/mercadopago` }
        : {}),
      statement_descriptor: "SOUBIZURADO",
    }),
  });
}

export type Payment = Readonly<{
  id: number;
  status: string;
  status_detail?: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  date_approved: string | null;
}>;

/** Source of truth for a payment: always fetched from the API, never taken from a redirect or a webhook body. */
export async function getPayment(paymentId: string): Promise<Payment> {
  if (!/^\d{1,20}$/.test(paymentId)) {
    throw new Error("Invalid Mercado Pago payment id.");
  }

  return request<Payment>(`/v1/payments/${paymentId}`);
}

/* ------------------------------------------------ Assinaturas (preapproval) */

export type Preapproval = Readonly<{
  id: string;
  status: string;
  init_point?: string;
  external_reference?: string | null;
  payer_email?: string | null;
  next_payment_date?: string | null;
  auto_recurring?: Readonly<{ transaction_amount?: number; currency_id?: string; frequency?: number; frequency_type?: string }>;
}>;

export type CreatePreapprovalInput = Readonly<{
  subscriptionId: string;
  reason: string;
  payerEmail: string;
  amountCents: number;
  frequencyMonths: number;
  backUrl: string;
}>;

const PREAPPROVAL_ID = /^[0-9a-zA-Z_-]{6,80}$/;

/** Recurring charge without a plan: the subscriber authorizes it on Mercado Pago (init_point). */
export async function createPreapproval(input: CreatePreapprovalInput): Promise<Preapproval> {
  return request<Preapproval>("/preapproval", {
    method: "POST",
    idempotencyKey: `preapproval-${input.subscriptionId}`,
    body: JSON.stringify({
      reason: input.reason.slice(0, 250),
      external_reference: input.subscriptionId,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: input.frequencyMonths,
        frequency_type: "months",
        transaction_amount: input.amountCents / 100,
        currency_id: "BRL",
      },
      back_url: input.backUrl,
      status: "pending",
    }),
  });
}

/** Source of truth for a subscription: always read from the API by id. */
export async function getPreapproval(preapprovalId: string): Promise<Preapproval> {
  if (!PREAPPROVAL_ID.test(preapprovalId)) throw new Error("Invalid Mercado Pago preapproval id.");
  return request<Preapproval>(`/preapproval/${preapprovalId}`);
}

/** Stops future charges (the subscriber keeps what was already paid). */
export async function cancelPreapproval(preapprovalId: string): Promise<Preapproval> {
  if (!PREAPPROVAL_ID.test(preapprovalId)) throw new Error("Invalid Mercado Pago preapproval id.");
  return request<Preapproval>(`/preapproval/${preapprovalId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

export type AuthorizedPayment = Readonly<{
  id: number | string;
  preapproval_id: string;
  status: string;
  transaction_amount: number;
  currency_id: string;
  payment?: Readonly<{ id?: number | string | null; status?: string | null }> | null;
}>;

/** One recurring charge of a subscription. */
export async function getAuthorizedPayment(authorizedPaymentId: string): Promise<AuthorizedPayment> {
  if (!/^\d{1,20}$/.test(authorizedPaymentId)) throw new Error("Invalid Mercado Pago authorized payment id.");
  return request<AuthorizedPayment>(`/authorized_payments/${authorizedPaymentId}`);
}

/** Charges of a subscription (used by the return page, before the webhook arrives). */
export async function searchAuthorizedPayments(preapprovalId: string): Promise<AuthorizedPayment[]> {
  if (!PREAPPROVAL_ID.test(preapprovalId)) throw new Error("Invalid Mercado Pago preapproval id.");
  const result = await request<{ results?: AuthorizedPayment[] }>(
    `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`,
  );
  return result.results ?? [];
}
