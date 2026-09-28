-- Store: offers (plans, exam combos), what they grant, and orders paid through Mercado Pago.
-- Additive migration: three new tables.
-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "headline" VARCHAR(240),
    "description" TEXT NOT NULL DEFAULT '',
    "price_cents" INTEGER NOT NULL,
    "compare_at_cents" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_grants" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "course_id" UUID,
    "duration_days" INTEGER,

    CONSTRAINT "offer_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "offer_snapshot" JSONB NOT NULL,
    "provider" VARCHAR(30) NOT NULL DEFAULT 'MERCADO_PAGO',
    "provider_preference_id" VARCHAR(120),
    "provider_payment_id" VARCHAR(60),
    "provider_status" VARCHAR(40),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offers_slug_key" ON "offers"("slug");

-- CreateIndex
CREATE INDEX "offers_is_active_sort_order_idx" ON "offers"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "offer_grants_offer_id_idx" ON "offer_grants"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_provider_payment_id_key" ON "orders"("provider_payment_id");

-- CreateIndex
CREATE INDEX "orders_profile_id_created_at_idx" ON "orders"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- AddForeignKey
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "offers" ADD CONSTRAINT "offers_price_check" CHECK ("price_cents" >= 0 AND ("compare_at_cents" IS NULL OR "compare_at_cents" > "price_cents"));
ALTER TABLE "offers" ADD CONSTRAINT "offers_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_kind_check" CHECK ("kind" IN ('QUESTION_BANK', 'COURSE'));
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_course_check" CHECK (("kind" = 'COURSE') = ("course_id" IS NOT NULL));
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_duration_check" CHECK ("duration_days" IS NULL OR "duration_days" BETWEEN 1 AND 3660);
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("status" IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_check" CHECK ("amount_cents" >= 0);

-- Server-only (admin actions, the buyer's session, the payment webhook); no policies (no Data API access).
ALTER TABLE "offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offer_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
