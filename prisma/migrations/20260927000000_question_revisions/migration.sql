-- Audit trail for manual question edits made in the backoffice.
-- Additive migration: one new table. Existing rows untouched.

-- CreateTable
CREATE TABLE "question_revisions" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "editor_profile_id" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "changed_fields" VARCHAR(60)[],
    "answer_key_changed" BOOLEAN NOT NULL DEFAULT false,
    "question_status" "QuestionStatus" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_revisions_question_id_created_at_idx" ON "question_revisions"("question_id", "created_at");

-- CreateIndex
CREATE INDEX "question_revisions_answer_key_changed_created_at_idx" ON "question_revisions"("answer_key_changed", "created_at");

-- AddForeignKey
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_editor_profile_id_fkey" FOREIGN KEY ("editor_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "question_revisions"
ADD CONSTRAINT "question_revisions_reason_check" CHECK (length(btrim("reason")) >= 3);

-- Server-only access through Prisma, consistent with existing tables.
ALTER TABLE "question_revisions" ENABLE ROW LEVEL SECURITY;
