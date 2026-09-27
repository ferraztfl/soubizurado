-- Timed practice exams ("Simulados").
-- Additive migration: two new tables. Existing rows untouched.

-- CreateTable
CREATE TABLE "study_simulations" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "filters" JSONB NOT NULL,
    "question_count" INTEGER NOT NULL,
    "time_limit_minutes" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    "correct_count" INTEGER,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "study_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_simulation_questions" (
    "id" UUID NOT NULL,
    "simulation_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "selected_alternative_id" UUID,
    "selected_true_false" BOOLEAN,
    "is_correct" BOOLEAN,
    "attempt_id" UUID,

    CONSTRAINT "study_simulation_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_simulations_profile_id_started_at_idx" ON "study_simulations"("profile_id", "started_at");

-- CreateIndex
CREATE INDEX "study_simulation_questions_question_id_idx" ON "study_simulation_questions"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_simulation_questions_simulation_id_position_key" ON "study_simulation_questions"("simulation_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "study_simulation_questions_simulation_id_question_id_key" ON "study_simulation_questions"("simulation_id", "question_id");

-- AddForeignKey
ALTER TABLE "study_simulations" ADD CONSTRAINT "study_simulations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_simulation_questions" ADD CONSTRAINT "study_simulation_questions_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "study_simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_simulation_questions" ADD CONSTRAINT "study_simulation_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "study_simulations"
ADD CONSTRAINT "study_simulations_status_check" CHECK ("status" IN ('IN_PROGRESS', 'FINISHED'));

ALTER TABLE "study_simulations"
ADD CONSTRAINT "study_simulations_question_count_check" CHECK ("question_count" BETWEEN 1 AND 180);

ALTER TABLE "study_simulations"
ADD CONSTRAINT "study_simulations_time_limit_check" CHECK ("time_limit_minutes" IS NULL OR "time_limit_minutes" BETWEEN 1 AND 600);

-- Server-only access through Prisma, consistent with existing tables.
ALTER TABLE "study_simulations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_simulation_questions" ENABLE ROW LEVEL SECURITY;
