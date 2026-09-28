import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyMercadoPagoSignature } from "./webhook-signature";

const secret = "test-secret";
const ts = "1742505638683";

function sign(manifest: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("verifyMercadoPagoSignature", () => {
  it("accepts the documented manifest", () => {
    const v1 = sign(`id:123456;request-id:req-1;ts:${ts};`);

    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "123456", secret }),
    ).toBe(true);
  });

  it("lower-cases alphanumeric ids and omits absent values", () => {
    const v1 = sign(`id:abc123;ts:${ts};`);

    expect(verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: null, dataId: "ABC123", secret })).toBe(true);
  });

  it("rejects tampering, a wrong secret or a missing header", () => {
    const v1 = sign(`id:123456;request-id:req-1;ts:${ts};`);

    expect(verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "999", secret })).toBe(false);
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "123456", secret: "other" }),
    ).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "123456", secret })).toBe(false);
  });

  it("rejects old notifications when a max age is given", () => {
    const v1 = sign(`id:1;ts:${ts};`);
    const input = { xSignature: `ts=${ts},v1=${v1}`, xRequestId: null, dataId: "1", secret, maxAgeMs: 60_000 };

    expect(verifyMercadoPagoSignature({ ...input, now: Number(ts) + 30_000 })).toBe(true);
    expect(verifyMercadoPagoSignature({ ...input, now: Number(ts) + 10 * 60_000 })).toBe(false);
  });
});
