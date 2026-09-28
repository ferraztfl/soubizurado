-- Study goals and privacy choices of each student (daily goal, target exam, ranking opt-out).
-- Additive migration: one new table. Existing rows untouched.
-- CreateTable
CREATE TABLE "study_preferences" (
    "profile_id" UUID NOT NULL,
    "daily_goal" SMALLINT NOT NULL DEFAULT 20,
    "target_exam" VARCHAR(180),
    "target_board_id" UUID,
    "target_exam_date" DATE,
    "show_in_ranking" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "study_preferences_pkey" PRIMARY KEY ("profile_id")
);

-- AddForeignKey
ALTER TABLE "study_preferences" ADD CONSTRAINT "study_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_preferences" ADD CONSTRAINT "study_preferences_target_board_id_fkey" FOREIGN KEY ("target_board_id") REFERENCES "examining_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "study_preferences" ADD CONSTRAINT "study_preferences_daily_goal_check" CHECK ("daily_goal" BETWEEN 1 AND 500);

-- Written only by server actions of the signed-in student; no policies (no Data API access).
ALTER TABLE "study_preferences" ENABLE ROW LEVEL SECURITY;
