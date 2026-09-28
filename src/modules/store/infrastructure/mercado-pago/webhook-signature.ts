import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Mercado Pago webhook signature (x-signature: "ts=…,v1=…"). Manifest, per
 * the official docs: "id:{data.id};request-id:{x-request-id};ts:{ts};",
 * leaving out pairs that are absent; data.id lower-cased; HMAC-SHA256 hex
 * with the application's webhook secret, compared in constant time.
 */

export type WebhookSignatureInput = Readonly<{
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
  /** Reject notifications older than this (replay protection); null = no check. */
  maxAgeMs?: number | null;
  now?: number;
}>;

export function verifyMercadoPagoSignature(input: WebhookSignatureInput): boolean {
  if (!input.xSignature || !input.secret) return false;

  let ts: string | null = null;
  let v1: string | null = null;

  for (const part of input.xSignature.split(",")) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=").trim();
    if (key?.trim() === "ts") ts = value;
    if (key?.trim() === "v1") v1 = value;
  }

  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  if (input.maxAgeMs != null) {
    const sent = Number(ts);
    // ts is in milliseconds.
    if (!Number.isFinite(sent) || Math.abs((input.now ?? Date.now()) - sent) > input.maxAgeMs) return false;
  }

  const parts: string[] = [];
  if (input.dataId) parts.push(`id:${input.dataId.toLowerCase()}`);
  if (input.xRequestId) parts.push(`request-id:${input.xRequestId}`);
  parts.push(`ts:${ts}`);
  const manifest = `${parts.join(";")};`;

  const expected = createHmac("sha256", input.secret).update(manifest).digest();
  const received = Buffer.from(v1, "hex");

  return received.length === expected.length && timingSafeEqual(received, expected);
}
