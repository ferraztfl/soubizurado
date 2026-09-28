-- Member area: courses, modules, lessons (text, PDF, video, question lists) and lesson progress;
-- course_id of offer_grants / entitlements now references courses.
-- Additive migration: five new tables and two foreign keys on columns that are still empty.
-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "subtitle" VARCHAR(240),
    "description" TEXT NOT NULL DEFAULT '',
    "cover_asset_id" UUID,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "position" INTEGER NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "video_embed_url" VARCHAR(500),
    "pdf_asset_id" UUID,
    "duration_minutes" INTEGER,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lesson_questions" (
    "lesson_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "course_lesson_questions_pkey" PRIMARY KEY ("lesson_id","question_id")
);

-- CreateTable
CREATE TABLE "course_lesson_progress" (
    "profile_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_lesson_progress_pkey" PRIMARY KEY ("profile_id","lesson_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "course_modules_course_id_position_idx" ON "course_modules"("course_id", "position");

-- CreateIndex
CREATE INDEX "course_lessons_module_id_position_idx" ON "course_lessons"("module_id", "position");

-- CreateIndex
CREATE INDEX "course_lesson_questions_lesson_id_position_idx" ON "course_lesson_questions"("lesson_id", "position");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_pdf_asset_id_fkey" FOREIGN KEY ("pdf_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lesson_questions" ADD CONSTRAINT "course_lesson_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lesson_questions" ADD CONSTRAINT "course_lesson_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lesson_progress" ADD CONSTRAINT "course_lesson_progress_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lesson_progress" ADD CONSTRAINT "course_lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "courses" ADD CONSTRAINT "courses_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_kind_check" CHECK ("kind" IN ('TEXT', 'PDF', 'VIDEO', 'QUESTIONS'));
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_duration_check" CHECK ("duration_minutes" IS NULL OR "duration_minutes" BETWEEN 1 AND 1440);
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_video_check" CHECK ("video_embed_url" IS NULL OR "video_embed_url" ~ '^https://');

-- Server-only (admin actions, the student's session, the protected PDF route); no policies (no Data API access).
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_lessons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_lesson_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_lesson_progress" ENABLE ROW LEVEL SECURITY;
