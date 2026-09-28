-- Freemium: daily answer count of signed-out visitors (hashed keys only; no personal data).
-- Additive migration: one new table.
-- CreateTable
CREATE TABLE "visitor_answer_usage" (
    "key_hash" CHAR(64) NOT NULL,
    "day" DATE NOT NULL,
    "answers" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visitor_answer_usage_pkey" PRIMARY KEY ("key_hash","day")
);

-- CreateIndex
CREATE INDEX "visitor_answer_usage_day_idx" ON "visitor_answer_usage"("day");


ALTER TABLE "visitor_answer_usage" ADD CONSTRAINT "visitor_answer_usage_answers_check" CHECK ("answers" >= 0);

-- Server-only; no policies (no Data API access).
ALTER TABLE "visitor_answer_usage" ENABLE ROW LEVEL SECURITY;
