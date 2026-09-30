-- Teoria Completa: courses generated from an edital verticalizado, lesson content status, student highlights/notes, reading position, and promotional price end on offers. Additive.
-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "promo_ends_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "syllabus_id" UUID;

-- AlterTable
ALTER TABLE "course_lessons" ADD COLUMN     "content_status" VARCHAR(20) NOT NULL DEFAULT 'EMPTY',
ADD COLUMN     "syllabus_topic_id" UUID;

-- CreateTable
CREATE TABLE "course_lesson_annotations" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "quote" VARCHAR(1000) NOT NULL,
    "prefix" VARCHAR(64) NOT NULL DEFAULT '',
    "suffix" VARCHAR(64) NOT NULL DEFAULT '',
    "note" VARCHAR(2000),
    "color" VARCHAR(20) NOT NULL DEFAULT 'yellow',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "course_lesson_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_reading_states" (
    "profile_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "scroll_percent" SMALLINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "course_reading_states_pkey" PRIMARY KEY ("profile_id","course_id")
);

-- CreateIndex
CREATE INDEX "course_lesson_annotations_profile_id_lesson_id_idx" ON "course_lesson_annotations"("profile_id", "lesson_id");

-- CreateIndex
CREATE INDEX "courses_syllabus_id_idx" ON "courses"("syllabus_id");

-- CreateIndex
CREATE INDEX "course_lessons_syllabus_topic_id_idx" ON "course_lessons"("syllabus_topic_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "contest_syllabi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_syllabus_topic_id_fkey" FOREIGN KEY ("syllabus_topic_id") REFERENCES "contest_syllabus_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lesson_annotations" ADD CONSTRAINT "course_lesson_annotations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lesson_annotations" ADD CONSTRAINT "course_lesson_annotations_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reading_states" ADD CONSTRAINT "course_reading_states_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reading_states" ADD CONSTRAINT "course_reading_states_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reading_states" ADD CONSTRAINT "course_reading_states_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_content_status_check" CHECK ("content_status" IN ('EMPTY','DRAFT','REVIEWED'));
ALTER TABLE "course_lesson_annotations" ADD CONSTRAINT "course_lesson_annotations_color_check" CHECK ("color" IN ('yellow','green','blue','pink'));
ALTER TABLE "course_lesson_annotations" ADD CONSTRAINT "course_lesson_annotations_quote_check" CHECK (char_length("quote") >= 1);
ALTER TABLE "course_reading_states" ADD CONSTRAINT "course_reading_states_scroll_check" CHECK ("scroll_percent" BETWEEN 0 AND 100);

-- Existing lessons with a body were written by the team.
UPDATE "course_lessons" SET "content_status" = 'REVIEWED' WHERE "body" <> '' OR "pdf_asset_id" IS NOT NULL OR "video_embed_url" IS NOT NULL;

-- Server-only; no policies (no Data API access).
ALTER TABLE "course_lesson_annotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_reading_states" ENABLE ROW LEVEL SECURITY;
