-- CreateTable
CREATE TABLE "study_answer_attempts" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "selected_alternative_id" UUID,
    "selected_true_false" BOOLEAN,
    "is_correct" BOOLEAN NOT NULL,
    "response_time_ms" INTEGER,
    "answered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_answer_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "study_answer_attempts_answer_shape_check" CHECK (
        (
            "question_type" = 'MULTIPLE_CHOICE'
            AND "selected_alternative_id" IS NOT NULL
            AND "selected_true_false" IS NULL
        )
        OR
        (
            "question_type" = 'TRUE_FALSE'
            AND "selected_alternative_id" IS NULL
            AND "selected_true_false" IS NOT NULL
        )
    ),
    CONSTRAINT "study_answer_attempts_response_time_ms_check" CHECK (
        "response_time_ms" IS NULL OR "response_time_ms" >= 0
    )
);

-- CreateTable
CREATE TABLE "study_favorites" (
    "profile_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_favorites_pkey" PRIMARY KEY ("profile_id", "question_id")
);

-- CreateIndex
CREATE INDEX "study_answer_attempts_profile_id_answered_at_idx"
ON "study_answer_attempts"("profile_id", "answered_at");

-- CreateIndex
CREATE INDEX "study_answer_attempts_profile_id_question_id_answered_at_idx"
ON "study_answer_attempts"("profile_id", "question_id", "answered_at");

-- CreateIndex
CREATE INDEX "study_answer_attempts_profile_id_is_correct_answered_at_idx"
ON "study_answer_attempts"("profile_id", "is_correct", "answered_at");

-- CreateIndex
CREATE INDEX "study_answer_attempts_question_id_answered_at_idx"
ON "study_answer_attempts"("question_id", "answered_at");

-- CreateIndex
CREATE INDEX "study_answer_attempts_selected_alternative_id_idx"
ON "study_answer_attempts"("selected_alternative_id");

-- CreateIndex
CREATE INDEX "study_favorites_profile_id_created_at_idx"
ON "study_favorites"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "study_favorites_question_id_profile_id_idx"
ON "study_favorites"("question_id", "profile_id");

-- AddForeignKey
ALTER TABLE "study_answer_attempts"
ADD CONSTRAINT "study_answer_attempts_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_answer_attempts"
ADD CONSTRAINT "study_answer_attempts_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "questions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_answer_attempts"
ADD CONSTRAINT "study_answer_attempts_selected_alternative_id_fkey"
FOREIGN KEY ("selected_alternative_id") REFERENCES "question_alternatives"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_favorites"
ADD CONSTRAINT "study_favorites_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_favorites"
ADD CONSTRAINT "study_favorites_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "questions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security
ALTER TABLE "study_answer_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_favorites" ENABLE ROW LEVEL SECURITY;
