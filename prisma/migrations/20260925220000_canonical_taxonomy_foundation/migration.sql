-- Canonical taxonomy foundation.
-- Additive migration: new tables/columns, stricter integrity for the
-- existing taxonomy links. No existing rows are modified.
--
-- * knowledge_areas: broad ENEM/BNCC areas grouping disciplines.
-- * *_aliases: alternative names resolving to canonical taxonomy
--   entries, unique per scope after normalization.
-- * taxonomy_revisions: monotonic taxonomy version.
-- * Composite foreign keys keep question area/topic inside the question
--   discipline and the subtopic inside the question topic. Verified on
--   2026-09-25: no question had area_id, topic_id or subtopic_id set.

-- CreateEnum
CREATE TYPE "TaxonomyAliasSource" AS ENUM ('SEED', 'MANUAL', 'IMPORT');

-- DropForeignKey
ALTER TABLE "topics" DROP CONSTRAINT "topics_area_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_area_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_subtopic_id_fkey";

-- AlterTable
ALTER TABLE "disciplines" ADD COLUMN     "knowledge_area_id" UUID;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "knowledge_area_id" UUID;

-- CreateTable
CREATE TABLE "knowledge_areas" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "knowledge_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discipline_aliases" (
    "id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,
    "source" "TaxonomyAliasSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discipline_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_aliases" (
    "id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,
    "source" "TaxonomyAliasSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_aliases" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,
    "source" "TaxonomyAliasSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtopic_aliases" (
    "id" UUID NOT NULL,
    "subtopic_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,
    "source" "TaxonomyAliasSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtopic_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_revisions" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "created_by_profile_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxonomy_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_areas_slug_key" ON "knowledge_areas"("slug");

-- CreateIndex
CREATE INDEX "knowledge_areas_is_active_sort_order_idx" ON "knowledge_areas"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "discipline_aliases_normalized_name_key" ON "discipline_aliases"("normalized_name");

-- CreateIndex
CREATE INDEX "discipline_aliases_discipline_id_idx" ON "discipline_aliases"("discipline_id");

-- CreateIndex
CREATE INDEX "area_aliases_area_id_idx" ON "area_aliases"("area_id");

-- CreateIndex
CREATE UNIQUE INDEX "area_aliases_discipline_id_normalized_name_key" ON "area_aliases"("discipline_id", "normalized_name");

-- CreateIndex
CREATE INDEX "topic_aliases_topic_id_idx" ON "topic_aliases"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_aliases_discipline_id_normalized_name_key" ON "topic_aliases"("discipline_id", "normalized_name");

-- CreateIndex
CREATE INDEX "subtopic_aliases_subtopic_id_idx" ON "subtopic_aliases"("subtopic_id");

-- CreateIndex
CREATE UNIQUE INDEX "subtopic_aliases_topic_id_normalized_name_key" ON "subtopic_aliases"("topic_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_revisions_version_key" ON "taxonomy_revisions"("version");

-- CreateIndex
CREATE INDEX "disciplines_knowledge_area_id_is_active_sort_order_idx" ON "disciplines"("knowledge_area_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "areas_id_discipline_id_key" ON "areas"("id", "discipline_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_id_discipline_id_key" ON "topics"("id", "discipline_id");

-- CreateIndex
CREATE UNIQUE INDEX "subtopics_id_topic_id_key" ON "subtopics"("id", "topic_id");

-- CreateIndex
CREATE INDEX "questions_status_knowledge_area_id_idx" ON "questions"("status", "knowledge_area_id");

-- AddForeignKey
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_knowledge_area_id_fkey" FOREIGN KEY ("knowledge_area_id") REFERENCES "knowledge_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_area_id_discipline_id_fkey" FOREIGN KEY ("area_id", "discipline_id") REFERENCES "areas"("id", "discipline_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "discipline_aliases" ADD CONSTRAINT "discipline_aliases_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_aliases" ADD CONSTRAINT "area_aliases_area_id_discipline_id_fkey" FOREIGN KEY ("area_id", "discipline_id") REFERENCES "areas"("id", "discipline_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_aliases" ADD CONSTRAINT "topic_aliases_topic_id_discipline_id_fkey" FOREIGN KEY ("topic_id", "discipline_id") REFERENCES "topics"("id", "discipline_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtopic_aliases" ADD CONSTRAINT "subtopic_aliases_subtopic_id_topic_id_fkey" FOREIGN KEY ("subtopic_id", "topic_id") REFERENCES "subtopics"("id", "topic_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_revisions" ADD CONSTRAINT "taxonomy_revisions_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_knowledge_area_id_fkey" FOREIGN KEY ("knowledge_area_id") REFERENCES "knowledge_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_area_id_discipline_id_fkey" FOREIGN KEY ("area_id", "discipline_id") REFERENCES "areas"("id", "discipline_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_discipline_id_fkey" FOREIGN KEY ("topic_id", "discipline_id") REFERENCES "topics"("id", "discipline_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subtopic_id_topic_id_fkey" FOREIGN KEY ("subtopic_id", "topic_id") REFERENCES "subtopics"("id", "topic_id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Composite foreign keys use MATCH SIMPLE and are skipped when any
-- column is NULL; these checks close that gap.
ALTER TABLE "questions"
ADD CONSTRAINT "questions_area_requires_discipline_check"
    CHECK ("area_id" IS NULL OR "discipline_id" IS NOT NULL);

ALTER TABLE "questions"
ADD CONSTRAINT "questions_topic_requires_discipline_check"
    CHECK ("topic_id" IS NULL OR "discipline_id" IS NOT NULL);

ALTER TABLE "questions"
ADD CONSTRAINT "questions_subtopic_requires_topic_check"
    CHECK ("subtopic_id" IS NULL OR "topic_id" IS NOT NULL);

ALTER TABLE "discipline_aliases"
ADD CONSTRAINT "discipline_aliases_normalized_name_check"
    CHECK (length(btrim("normalized_name")) > 0);

ALTER TABLE "area_aliases"
ADD CONSTRAINT "area_aliases_normalized_name_check"
    CHECK (length(btrim("normalized_name")) > 0);

ALTER TABLE "topic_aliases"
ADD CONSTRAINT "topic_aliases_normalized_name_check"
    CHECK (length(btrim("normalized_name")) > 0);

ALTER TABLE "subtopic_aliases"
ADD CONSTRAINT "subtopic_aliases_normalized_name_check"
    CHECK (length(btrim("normalized_name")) > 0);

ALTER TABLE "taxonomy_revisions"
ADD CONSTRAINT "taxonomy_revisions_version_check"
    CHECK ("version" > 0);

-- Server-only access through Prisma, consistent with existing tables.
ALTER TABLE "knowledge_areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discipline_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "area_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "topic_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subtopic_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "taxonomy_revisions" ENABLE ROW LEVEL SECURITY;
