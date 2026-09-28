-- Recurring Premium subscriptions (Mercado Pago preapproval) and their charges. Additive: two new tables.
-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'MERCADOPAGO',
    "provider_subscription_id" VARCHAR(80),
    "plan_key" VARCHAR(40) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "provider_status" VARCHAR(40),
    "next_charge_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "provider_payment_id" VARCHAR(80) NOT NULL,
    "payment_id" VARCHAR(40),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "provider_status" VARCHAR(40),
    "amount_cents" INTEGER NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_profile_id_status_idx" ON "subscriptions"("profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_provider_payment_id_key" ON "subscription_payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "subscription_payments_subscription_id_idx" ON "subscription_payments"("subscription_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ("status" IN ('PENDING','AUTHORIZED','PAUSED','CANCELLED'));
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_amount_check" CHECK ("amount_cents" > 0);
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_provider_check" CHECK ("provider" IN ('MERCADOPAGO'));
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_status_check" CHECK ("status" IN ('PENDING','PAID','FAILED','REFUNDED'));
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_amount_check" CHECK ("amount_cents" >= 0);

-- Server-only; no policies (no Data API access).
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_payments" ENABLE ROW LEVEL SECURITY;
