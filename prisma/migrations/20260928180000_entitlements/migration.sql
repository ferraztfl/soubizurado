-- Access rights (premium question bank, courses): admin grants now, paid orders later.
-- Additive migration: one new table.
-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "course_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "source" VARCHAR(30) NOT NULL,
    "source_id" UUID,
    "granted_by_profile_id" UUID,
    "note" VARCHAR(300),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entitlements_profile_id_kind_idx" ON "entitlements"("profile_id", "kind");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_granted_by_profile_id_fkey" FOREIGN KEY ("granted_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_kind_check" CHECK ("kind" IN ('QUESTION_BANK', 'COURSE'));
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_source_check" CHECK ("source" IN ('ADMIN', 'ORDER', 'SUBSCRIPTION'));
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_course_check" CHECK (("kind" = 'COURSE') = ("course_id" IS NOT NULL));
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_period_check" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

-- Server-only (requireAdminUser / the student's own session); no policies (no Data API access).
ALTER TABLE "entitlements" ENABLE ROW LEVEL SECURITY;
