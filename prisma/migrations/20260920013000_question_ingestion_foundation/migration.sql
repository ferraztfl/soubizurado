-- EnableExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterEnum
ALTER TYPE "QuestionSourceType" ADD VALUE 'PROVIDER_API';

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'PARTIAL',
    'FAILED'
);

-- CreateEnum
CREATE TYPE "ImportItemStatus" AS ENUM (
    'RECEIVED',
    'IMPORTED',
    'DUPLICATE',
    'REVIEW_REQUIRED',
    'FAILED'
);

-- AlterTable
ALTER TABLE "questions"
ADD COLUMN "canonical_fingerprint" CHAR(64),
ADD COLUMN "normalization_version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "question_sources_reference_key"
ON "question_sources"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "questions_canonical_fingerprint_key"
ON "questions"("canonical_fingerprint");

-- CreateIndex
CREATE INDEX "questions_statement_trgm_idx"
ON "questions"
USING GIN (lower("statement") gin_trgm_ops);

-- CreateTable
CREATE TABLE "question_support_contents" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_support_contents_pkey"
    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_support_contents_content_hash_key"
ON "question_support_contents"("content_hash");

-- CreateTable
CREATE TABLE "question_support_links" (
    "question_id" UUID NOT NULL,
    "support_content_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "question_support_links_pkey"
    PRIMARY KEY ("question_id", "support_content_id"),
    CONSTRAINT "question_support_links_position_check"
    CHECK ("position" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "question_support_links_question_id_position_key"
ON "question_support_links"("question_id", "position");

-- CreateIndex
CREATE INDEX "question_support_links_support_content_id_question_id_idx"
ON "question_support_links"("support_content_id", "question_id");

-- CreateTable
CREATE TABLE "question_occurrences" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "examination_id" UUID,
    "external_id" VARCHAR(180) NOT NULL,
    "external_question_number" VARCHAR(60),
    "external_examination_id" VARCHAR(180),
    "source_url" TEXT,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_occurrences_pkey"
    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_occurrences_source_id_external_id_key"
ON "question_occurrences"("source_id", "external_id");

-- CreateIndex
CREATE INDEX "question_occurrences_question_id_captured_at_idx"
ON "question_occurrences"("question_id", "captured_at");

-- CreateIndex
CREATE INDEX "question_occurrences_examination_id_idx"
ON "question_occurrences"("examination_id");

-- CreateIndex
CREATE INDEX "question_occurrences_source_id_external_examination_id_idx"
ON "question_occurrences"("source_id", "external_examination_id");

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "cursor_start" VARCHAR(200),
    "cursor_end" VARCHAR(200),
    "requested_limit" INTEGER,
    "received_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_jobs_pkey"
    PRIMARY KEY ("id"),
    CONSTRAINT "import_jobs_requested_limit_check"
    CHECK ("requested_limit" IS NULL OR "requested_limit" > 0),
    CONSTRAINT "import_jobs_counts_check"
    CHECK (
        "received_count" >= 0
        AND "imported_count" >= 0
        AND "duplicate_count" >= 0
        AND "review_count" >= 0
        AND "failed_count" >= 0
    )
);

-- CreateIndex
CREATE INDEX "import_jobs_source_id_created_at_idx"
ON "import_jobs"("source_id", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_status_created_at_idx"
ON "import_jobs"("status", "created_at");

-- CreateTable
CREATE TABLE "import_items" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "external_id" VARCHAR(180) NOT NULL,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'RECEIVED',
    "raw_payload" JSONB NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "question_id" UUID,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_items_pkey"
    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_items_job_id_external_id_key"
ON "import_items"("job_id", "external_id");

-- CreateIndex
CREATE INDEX "import_items_question_id_idx"
ON "import_items"("question_id");

-- CreateIndex
CREATE INDEX "import_items_status_created_at_idx"
ON "import_items"("status", "created_at");

-- CreateTable
CREATE TABLE "import_duplicate_candidates" (
    "id" UUID NOT NULL,
    "import_item_id" UUID NOT NULL,
    "candidate_question_id" UUID NOT NULL,
    "similarity" DECIMAL(5,4) NOT NULL,
    "reason" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_duplicate_candidates_pkey"
    PRIMARY KEY ("id"),
    CONSTRAINT "import_duplicate_candidates_similarity_check"
    CHECK ("similarity" >= 0 AND "similarity" <= 1)
);

-- CreateIndex
CREATE UNIQUE INDEX "import_duplicate_candidates_import_item_id_candidate_question_id_key"
ON "import_duplicate_candidates"("import_item_id", "candidate_question_id");

-- CreateIndex
CREATE INDEX "import_duplicate_candidates_candidate_question_id_similarity_idx"
ON "import_duplicate_candidates"("candidate_question_id", "similarity");

-- AddForeignKey
ALTER TABLE "question_support_links"
ADD CONSTRAINT "question_support_links_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "questions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_support_links"
ADD CONSTRAINT "question_support_links_support_content_id_fkey"
FOREIGN KEY ("support_content_id")
REFERENCES "question_support_contents"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_occurrences"
ADD CONSTRAINT "question_occurrences_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "questions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_occurrences"
ADD CONSTRAINT "question_occurrences_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "question_sources"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_occurrences"
ADD CONSTRAINT "question_occurrences_examination_id_fkey"
FOREIGN KEY ("examination_id") REFERENCES "examinations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs"
ADD CONSTRAINT "import_jobs_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "question_sources"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items"
ADD CONSTRAINT "import_items_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "import_jobs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items"
ADD CONSTRAINT "import_items_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "questions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_duplicate_candidates"
ADD CONSTRAINT "import_duplicate_candidates_import_item_id_fkey"
FOREIGN KEY ("import_item_id") REFERENCES "import_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_duplicate_candidates"
ADD CONSTRAINT "import_duplicate_candidates_candidate_question_id_fkey"
FOREIGN KEY ("candidate_question_id") REFERENCES "questions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable Row Level Security
ALTER TABLE "question_support_contents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_support_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_occurrences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_duplicate_candidates" ENABLE ROW LEVEL SECURITY;
