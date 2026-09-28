import { beforeEach, describe, expect, it, vi } from "vitest";

const payment = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const db = vi.hoisted(() => {
  const state = { orderStatus: "PENDING", entitlements: [] as Record<string, unknown>[], revoked: 0 };
  const client = {
    order: {
      findUnique: vi.fn(async () => ({
        id: "11111111-1111-1111-1111-111111111111",
        profileId: "profile-1",
        status: state.orderStatus,
        amountCents: 3990,
        currency: "BRL",
        offer: { grants: [{ kind: "QUESTION_BANK", durationDays: 180, courseId: null }] },
      })),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async (args: { where: { status: string | { in: string[] } }; data: { status?: string } }) => {
        const allowed = typeof args.where.status === "string" ? [args.where.status] : args.where.status.in;
        if (!allowed.includes(state.orderStatus)) return { count: 0 };
        if (args.data.status) state.orderStatus = args.data.status;
        return { count: 1 };
      }),
    },
    entitlement: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        state.entitlements.push(args.data);
        return args.data;
      }),
      updateMany: vi.fn(async () => {
        state.revoked += 1;
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(client)),
  };
  return { state, client };
});

vi.mock("@/shared/infrastructure/database/prisma", () => ({ getPrismaClient: () => db.client }));
vi.mock("./mercado-pago/mercado-pago-client", () => ({ getPayment: vi.fn(async () => payment.current) }));

import { processMercadoPagoPayment } from "./process-payment";

const approved = {
  id: 987,
  status: "approved",
  external_reference: "11111111-1111-1111-1111-111111111111",
  transaction_amount: 39.9,
  currency_id: "BRL",
  date_approved: "2026-09-28T12:00:00.000Z",
};

describe("processMercadoPagoPayment", () => {
  beforeEach(() => {
    db.state.orderStatus = "PENDING";
    db.state.entitlements = [];
    db.state.revoked = 0;
  });

  it("grants access once, even when notified twice", async () => {
    payment.current = approved;

    expect(await processMercadoPagoPayment("987")).toMatchObject({ kind: "UPDATED", status: "PAID", granted: true });
    expect(await processMercadoPagoPayment("987")).toMatchObject({ kind: "UPDATED", status: "PAID", granted: false });
    expect(db.state.entitlements).toHaveLength(1);
    expect(db.state.entitlements[0]).toMatchObject({
      profileId: "profile-1",
      kind: "QUESTION_BANK",
      source: "ORDER",
      endsAt: new Date("2027-03-27T12:00:00.000Z"),
    });
  });

  it("never grants when the paid amount differs from the order", async () => {
    payment.current = { ...approved, transaction_amount: 1 };

    expect(await processMercadoPagoPayment("987")).toMatchObject({ kind: "AMOUNT_MISMATCH" });
    expect(db.state.entitlements).toHaveLength(0);
  });

  it("a refund of a paid order revokes its access", async () => {
    payment.current = approved;
    await processMercadoPagoPayment("987");

    payment.current = { ...approved, status: "refunded" };
    expect(await processMercadoPagoPayment("987")).toMatchObject({ status: "REFUNDED" });
    expect(db.state.orderStatus).toBe("REFUNDED");
    expect(db.state.revoked).toBe(1);
  });

  it("ignores payments of unknown orders", async () => {
    payment.current = { ...approved, external_reference: "not-an-order" };

    expect(await processMercadoPagoPayment("987")).toEqual({ kind: "UNKNOWN_ORDER" });
  });
});
