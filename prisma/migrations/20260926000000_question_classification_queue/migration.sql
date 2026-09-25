-- Persistent question classification queue.
-- Additive migration: one new enum and table. Existing rows untouched.
-- Suggestions are stored for review; nothing is applied to questions.

-- CreateEnum
CREATE TYPE "QuestionClassificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REVIEW_REQUIRED', 'FAILED');

-- CreateTable
CREATE TABLE "question_classification_tasks" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "status" "QuestionClassificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "provider" VARCHAR(60) NOT NULL,
    "model" VARCHAR(120),
    "classifier_version" VARCHAR(40) NOT NULL,
    "taxonomy_version" INTEGER NOT NULL,
    "confidence" DECIMAL(5,4),
    "suggested_discipline_id" UUID,
    "suggested_area_id" UUID,
    "suggested_topic_id" UUID,
    "suggested_subtopic_id" UUID,
    "suggested_tags" VARCHAR(120)[] DEFAULT ARRAY[]::VARCHAR(120)[],
    "raw_result" JSONB,
    "error_message" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "applied_at" TIMESTAMPTZ(6),
    "applied_by_profile_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_classification_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_classification_tasks_status_next_attempt_at_create_idx" ON "question_classification_tasks"("status", "next_attempt_at", "created_at");

-- CreateIndex
CREATE INDEX "question_classification_tasks_question_id_created_at_idx" ON "question_classification_tasks"("question_id", "created_at");

-- CreateIndex
CREATE INDEX "question_classification_tasks_suggested_discipline_id_idx" ON "question_classification_tasks"("suggested_discipline_id");

-- CreateIndex
CREATE INDEX "question_classification_tasks_suggested_topic_id_idx" ON "question_classification_tasks"("suggested_topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_classification_tasks_question_id_classifier_versio_key" ON "question_classification_tasks"("question_id", "classifier_version", "taxonomy_version");

-- AddForeignKey
ALTER TABLE "question_classification_tasks" ADD CONSTRAINT "question_classification_tasks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_classification_tasks" ADD CONSTRAINT "question_classification_tasks_suggested_discipline_id_fkey" FOREIGN KEY ("suggested_discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_classification_tasks" ADD CONSTRAINT "question_classification_tasks_suggested_area_id_fkey" FOREIGN KEY ("suggested_area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_classification_tasks" ADD CONSTRAINT "question_classification_tasks_suggested_topic_id_fkey" FOREIGN KEY ("suggested_topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_classification_tasks" ADD CONSTRAINT "question_classification_tasks_suggested_subtopic_id_fkey" FOREIGN KEY ("suggested_subtopic_id") REFERENCES "subtopics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_classification_tasks" ADD CONSTRAINT "question_classification_tasks_applied_by_profile_id_fkey" FOREIGN KEY ("applied_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "question_classification_tasks"
ADD CONSTRAINT "question_classification_tasks_attempts_check"
    CHECK ("attempts" >= 0);

ALTER TABLE "question_classification_tasks"
ADD CONSTRAINT "question_classification_tasks_confidence_check"
    CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

ALTER TABLE "question_classification_tasks"
ADD CONSTRAINT "question_classification_tasks_subtopic_requires_topic_check"
    CHECK ("suggested_subtopic_id" IS NULL OR "suggested_topic_id" IS NOT NULL);

-- Server-only access through Prisma, consistent with existing tables.
ALTER TABLE "question_classification_tasks" ENABLE ROW LEVEL SECURITY;
