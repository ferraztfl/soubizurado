import { NextResponse, type NextRequest } from "next/server";

import { processMercadoPagoPayment } from "@/modules/store/infrastructure/process-payment";
import { verifyMercadoPagoSignature } from "@/modules/store/infrastructure/mercado-pago/webhook-signature";

/*
 * Mercado Pago payment notifications. Only signed notifications are
 * accepted (MERCADOPAGO_WEBHOOK_SECRET, from "Suas integrações > Webhooks");
 * the body is never trusted: the payment is fetched from the API by id.
 * 200 = handled (or not ours); 5xx = Mercado Pago retries later.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  let body: { type?: string; data?: { id?: string | number } } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Some notifications carry everything in the query string.
  }

  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? null;
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? (body.data?.id != null ? String(body.data.id) : null);
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? "";

  const signed = verifyMercadoPagoSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
    secret,
  });

  if (!signed) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (type !== "payment" || !dataId || !/^\d{1,20}$/.test(dataId)) {
    return NextResponse.json({ ignored: true });
  }

  try {
    const result = await processMercadoPagoPayment(dataId);
    return NextResponse.json({ ok: true, result: result.kind });
  } catch {
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
