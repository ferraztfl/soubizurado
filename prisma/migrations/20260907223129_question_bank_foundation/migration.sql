-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionAnswerKeyStatus" AS ENUM ('MISSING', 'DEFINED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "QuestionSourceType" AS ENUM ('OFFICIAL_EXAM', 'ORIGINAL', 'LICENSED', 'OTHER');

-- CreateEnum
CREATE TYPE "QuestionLicenseStatus" AS ENUM ('UNKNOWN', 'PUBLIC_DOMAIN', 'AUTHORIZED', 'LICENSED', 'RESTRICTED');

-- CreateTable
CREATE TABLE "disciplines" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "area_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtopics" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subtopics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examining_boards" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "acronym" VARCHAR(40),
    "slug" VARCHAR(200) NOT NULL,
    "website_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "examining_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "acronym" VARCHAR(40),
    "slug" VARCHAR(220) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "public_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_positions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "career_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examinations" (
    "id" UUID NOT NULL,
    "board_id" UUID,
    "organization_id" UUID,
    "career_position_id" UUID,
    "title" VARCHAR(240) NOT NULL,
    "slug" VARCHAR(260) NOT NULL,
    "year" SMALLINT,
    "state_code" CHAR(2),
    "notice_number" VARCHAR(80),
    "exam_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "examinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_sources" (
    "id" UUID NOT NULL,
    "source_type" "QuestionSourceType" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "reference" VARCHAR(250),
    "url" TEXT,
    "license_status" "QuestionLicenseStatus" NOT NULL DEFAULT 'UNKNOWN',
    "license_name" VARCHAR(160),
    "license_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "type" "QuestionType" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "answer_key_status" "QuestionAnswerKeyStatus" NOT NULL DEFAULT 'MISSING',
    "statement" TEXT NOT NULL,
    "content_hash" CHAR(64),
    "correct_true_false" BOOLEAN,
    "source_id" UUID,
    "examination_id" UUID,
    "discipline_id" UUID,
    "area_id" UUID,
    "topic_id" UUID,
    "subtopic_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_alternatives" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "label" VARCHAR(8) NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_explanations" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_tags" (
    "question_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_tags_pkey" PRIMARY KEY ("question_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disciplines_slug_key" ON "disciplines"("slug");

-- CreateIndex
CREATE INDEX "disciplines_is_active_sort_order_idx" ON "disciplines"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "areas_discipline_id_is_active_sort_order_idx" ON "areas"("discipline_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "areas_discipline_id_slug_key" ON "areas"("discipline_id", "slug");

-- CreateIndex
CREATE INDEX "topics_discipline_id_is_active_sort_order_idx" ON "topics"("discipline_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "topics_area_id_is_active_sort_order_idx" ON "topics"("area_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "topics_discipline_id_slug_key" ON "topics"("discipline_id", "slug");

-- CreateIndex
CREATE INDEX "subtopics_topic_id_is_active_sort_order_idx" ON "subtopics"("topic_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "subtopics_topic_id_slug_key" ON "subtopics"("topic_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_is_active_idx" ON "tags"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "examining_boards_slug_key" ON "examining_boards"("slug");

-- CreateIndex
CREATE INDEX "examining_boards_is_active_name_idx" ON "examining_boards"("is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "public_organizations_slug_key" ON "public_organizations"("slug");

-- CreateIndex
CREATE INDEX "public_organizations_is_active_name_idx" ON "public_organizations"("is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "career_positions_slug_key" ON "career_positions"("slug");

-- CreateIndex
CREATE INDEX "career_positions_is_active_name_idx" ON "career_positions"("is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "examinations_slug_key" ON "examinations"("slug");

-- CreateIndex
CREATE INDEX "examinations_board_id_year_idx" ON "examinations"("board_id", "year");

-- CreateIndex
CREATE INDEX "examinations_organization_id_year_idx" ON "examinations"("organization_id", "year");

-- CreateIndex
CREATE INDEX "examinations_career_position_id_year_idx" ON "examinations"("career_position_id", "year");

-- CreateIndex
CREATE INDEX "examinations_is_active_year_idx" ON "examinations"("is_active", "year");

-- CreateIndex
CREATE INDEX "question_sources_source_type_license_status_idx" ON "question_sources"("source_type", "license_status");

-- CreateIndex
CREATE INDEX "questions_status_type_idx" ON "questions"("status", "type");

-- CreateIndex
CREATE INDEX "questions_status_discipline_id_idx" ON "questions"("status", "discipline_id");

-- CreateIndex
CREATE INDEX "questions_status_topic_id_idx" ON "questions"("status", "topic_id");

-- CreateIndex
CREATE INDEX "questions_status_subtopic_id_idx" ON "questions"("status", "subtopic_id");

-- CreateIndex
CREATE INDEX "questions_status_examination_id_idx" ON "questions"("status", "examination_id");

-- CreateIndex
CREATE INDEX "questions_source_id_idx" ON "questions"("source_id");

-- CreateIndex
CREATE INDEX "questions_content_hash_idx" ON "questions"("content_hash");

-- CreateIndex
CREATE INDEX "question_alternatives_question_id_is_correct_idx" ON "question_alternatives"("question_id", "is_correct");

-- CreateIndex
CREATE UNIQUE INDEX "question_alternatives_question_id_label_key" ON "question_alternatives"("question_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "question_alternatives_question_id_position_key" ON "question_alternatives"("question_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "question_explanations_question_id_key" ON "question_explanations"("question_id");

-- CreateIndex
CREATE INDEX "question_tags_tag_id_question_id_idx" ON "question_tags"("tag_id", "question_id");

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "examining_boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_career_position_id_fkey" FOREIGN KEY ("career_position_id") REFERENCES "career_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "question_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_examination_id_fkey" FOREIGN KEY ("examination_id") REFERENCES "examinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "subtopics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_alternatives" ADD CONSTRAINT "question_alternatives_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_explanations" ADD CONSTRAINT "question_explanations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_tags" ADD CONSTRAINT "question_tags_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_tags" ADD CONSTRAINT "question_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Enable Row Level Security
ALTER TABLE "disciplines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subtopics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "examining_boards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public_organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "examinations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_alternatives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_explanations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_tags" ENABLE ROW LEVEL SECURITY;
