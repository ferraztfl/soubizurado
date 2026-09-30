-- "Edital verticalizado" per contest position (subjects, question counts, syllabus topics) and the student's checklist. Additive.
-- CreateTable
CREATE TABLE "contest_syllabi" (
    "id" UUID NOT NULL,
    "contest_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "essay_points" INTEGER,
    "duration_minutes" INTEGER,
    "notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contest_syllabi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_syllabus_subjects" (
    "id" UUID NOT NULL,
    "syllabus_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "question_count" INTEGER,
    "block" VARCHAR(40),
    "discipline_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contest_syllabus_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_syllabus_topics" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "code" VARCHAR(20),
    "text" VARCHAR(600) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contest_syllabus_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_syllabus_progress" (
    "profile_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "studied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_syllabus_progress_pkey" PRIMARY KEY ("profile_id","topic_id")
);

-- CreateIndex
CREATE INDEX "contest_syllabi_contest_id_sort_order_idx" ON "contest_syllabi"("contest_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "contest_syllabi_contest_id_slug_key" ON "contest_syllabi"("contest_id", "slug");

-- CreateIndex
CREATE INDEX "contest_syllabus_subjects_syllabus_id_sort_order_idx" ON "contest_syllabus_subjects"("syllabus_id", "sort_order");

-- CreateIndex
CREATE INDEX "contest_syllabus_subjects_discipline_id_idx" ON "contest_syllabus_subjects"("discipline_id");

-- CreateIndex
CREATE INDEX "contest_syllabus_topics_subject_id_sort_order_idx" ON "contest_syllabus_topics"("subject_id", "sort_order");

-- CreateIndex
CREATE INDEX "study_syllabus_progress_topic_id_idx" ON "study_syllabus_progress"("topic_id");

-- AddForeignKey
ALTER TABLE "contest_syllabi" ADD CONSTRAINT "contest_syllabi_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_syllabus_subjects" ADD CONSTRAINT "contest_syllabus_subjects_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "contest_syllabi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_syllabus_subjects" ADD CONSTRAINT "contest_syllabus_subjects_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_syllabus_topics" ADD CONSTRAINT "contest_syllabus_topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "contest_syllabus_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_syllabus_progress" ADD CONSTRAINT "study_syllabus_progress_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_syllabus_progress" ADD CONSTRAINT "study_syllabus_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "contest_syllabus_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guard values also at the database level.
ALTER TABLE "contest_syllabi" ADD CONSTRAINT "contest_syllabi_essay_points_check" CHECK ("essay_points" IS NULL OR "essay_points" >= 0);
ALTER TABLE "contest_syllabi" ADD CONSTRAINT "contest_syllabi_duration_check" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0);
ALTER TABLE "contest_syllabi" ADD CONSTRAINT "contest_syllabi_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "contest_syllabus_subjects" ADD CONSTRAINT "contest_syllabus_subjects_question_count_check" CHECK ("question_count" IS NULL OR "question_count" >= 0);

-- Server-only; no policies (no Data API access).
ALTER TABLE "contest_syllabi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contest_syllabus_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contest_syllabus_topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_syllabus_progress" ENABLE ROW LEVEL SECURITY;
