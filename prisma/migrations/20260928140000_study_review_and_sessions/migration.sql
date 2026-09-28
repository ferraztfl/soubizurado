-- Guided study ("Estudar"): spaced review of mistakes and study sessions.
-- Additive migration: three new tables + a one-off fill of the review queue from existing answers.
-- CreateTable
CREATE TABLE "study_review_items" (
    "profile_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "step" SMALLINT NOT NULL DEFAULT 0,
    "due_on" DATE NOT NULL,
    "lapses" INTEGER NOT NULL DEFAULT 1,
    "last_answered_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "study_review_items_pkey" PRIMARY KEY ("profile_id","question_id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "question_count" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    "correct_count" INTEGER,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_session_questions" (
    "session_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "study_session_questions_pkey" PRIMARY KEY ("session_id","position")
);

-- CreateIndex
CREATE INDEX "study_review_items_profile_id_due_on_idx" ON "study_review_items"("profile_id", "due_on");

-- CreateIndex
CREATE INDEX "study_sessions_profile_id_started_at_idx" ON "study_sessions"("profile_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "study_session_questions_session_id_question_id_key" ON "study_session_questions"("session_id", "question_id");

-- AddForeignKey
ALTER TABLE "study_review_items" ADD CONSTRAINT "study_review_items_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_review_items" ADD CONSTRAINT "study_review_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_questions" ADD CONSTRAINT "study_session_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_questions" ADD CONSTRAINT "study_session_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "study_review_items" ADD CONSTRAINT "study_review_items_step_check" CHECK ("step" BETWEEN 0 AND 10);
ALTER TABLE "study_review_items" ADD CONSTRAINT "study_review_items_lapses_check" CHECK ("lapses" >= 0);
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_mode_check" CHECK ("mode" IN ('NEW', 'REVIEW', 'MIXED'));
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_status_check" CHECK ("status" IN ('IN_PROGRESS', 'FINISHED'));
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_question_count_check" CHECK ("question_count" BETWEEN 1 AND 200);
ALTER TABLE "study_session_questions" ADD CONSTRAINT "study_session_questions_position_check" CHECK ("position" >= 0);

-- Written only by server code of the signed-in student; no policies (no Data API access).
ALTER TABLE "study_review_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_session_questions" ENABLE ROW LEVEL SECURITY;

-- One-off: questions whose latest answer was wrong start in the review queue, due today.
INSERT INTO "study_review_items" ("profile_id", "question_id", "step", "due_on", "lapses", "last_answered_at", "updated_at")
SELECT latest."profile_id",
       latest."question_id",
       0,
       (now() AT TIME ZONE 'America/Sao_Paulo')::date,
       wrong."lapses",
       latest."answered_at",
       now()
FROM (
  SELECT DISTINCT ON ("profile_id", "question_id") "profile_id", "question_id", "is_correct", "answered_at"
  FROM "study_answer_attempts"
  ORDER BY "profile_id", "question_id", "answered_at" DESC
) AS latest
JOIN (
  SELECT "profile_id", "question_id", count(*)::int AS "lapses"
  FROM "study_answer_attempts"
  WHERE NOT "is_correct"
  GROUP BY "profile_id", "question_id"
) AS wrong USING ("profile_id", "question_id")
WHERE NOT latest."is_correct"
ON CONFLICT DO NOTHING;
