-- Student notes on questions and "Reportar erro" reports.
-- Additive migration: two new tables. Existing rows untouched.

-- CreateTable
CREATE TABLE "study_question_notes" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "study_question_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_error_reports" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "reporter_profile_id" UUID,
    "reason" VARCHAR(40) NOT NULL,
    "details" VARCHAR(1000),
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "resolution_note" VARCHAR(500),
    "resolver_profile_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_error_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_question_notes_question_id_idx" ON "study_question_notes"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_question_notes_profile_id_question_id_key" ON "study_question_notes"("profile_id", "question_id");

-- CreateIndex
CREATE INDEX "question_error_reports_status_created_at_idx" ON "question_error_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "question_error_reports_question_id_status_idx" ON "question_error_reports"("question_id", "status");

-- AddForeignKey
ALTER TABLE "study_question_notes" ADD CONSTRAINT "study_question_notes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_question_notes" ADD CONSTRAINT "study_question_notes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_error_reports" ADD CONSTRAINT "question_error_reports_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_error_reports" ADD CONSTRAINT "question_error_reports_reporter_profile_id_fkey" FOREIGN KEY ("reporter_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_error_reports" ADD CONSTRAINT "question_error_reports_resolver_profile_id_fkey" FOREIGN KEY ("resolver_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "study_question_notes"
ADD CONSTRAINT "study_question_notes_content_check" CHECK (length(btrim("content")) >= 1);

ALTER TABLE "question_error_reports"
ADD CONSTRAINT "question_error_reports_reason_check" CHECK (
  "reason" IN ('WRONG_ANSWER_KEY', 'TYPO', 'MISSING_CONTENT', 'WRONG_CLASSIFICATION', 'OUTDATED', 'OTHER')
);

ALTER TABLE "question_error_reports"
ADD CONSTRAINT "question_error_reports_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED', 'DISMISSED'));

-- One open report per student and question (anti-spam).
CREATE UNIQUE INDEX "question_error_reports_one_open_per_reporter_key"
ON "question_error_reports"("question_id", "reporter_profile_id")
WHERE "status" = 'OPEN';

-- Server-only access through Prisma, consistent with existing tables.
ALTER TABLE "study_question_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_error_reports" ENABLE ROW LEVEL SECURITY;
