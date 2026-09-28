-- Contests (concursos) followed by the editorial team, and an optional link from blog posts to a contest.
-- Additive migration: one new table, one new nullable column.
-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "contest_id" UUID;

-- CreateTable
CREATE TABLE "contests" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "organization_name" VARCHAR(200) NOT NULL,
    "organization_id" UUID,
    "board_id" UUID,
    "career_category_id" UUID,
    "state_code" CHAR(2),
    "status" VARCHAR(30) NOT NULL DEFAULT 'EXPECTED',
    "vacancies" INTEGER,
    "has_reserve_list" BOOLEAN NOT NULL DEFAULT false,
    "salary_min_cents" INTEGER,
    "salary_max_cents" INTEGER,
    "education_levels" VARCHAR(20)[] DEFAULT ARRAY[]::VARCHAR(20)[],
    "positions" VARCHAR(1000) NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "registration_start" DATE,
    "registration_end" DATE,
    "exam_date" DATE,
    "notice_url" VARCHAR(500),
    "related_offer_id" UUID,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contests_slug_key" ON "contests"("slug");

-- CreateIndex
CREATE INDEX "contests_is_published_status_idx" ON "contests"("is_published", "status");

-- CreateIndex
CREATE INDEX "contests_is_published_is_featured_idx" ON "contests"("is_published", "is_featured");

-- CreateIndex
CREATE INDEX "contests_state_code_idx" ON "contests"("state_code");

-- CreateIndex
CREATE INDEX "blog_posts_contest_id_published_at_idx" ON "blog_posts"("contest_id", "published_at");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "examining_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_career_category_id_fkey" FOREIGN KEY ("career_category_id") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_related_offer_id_fkey" FOREIGN KEY ("related_offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "contests" ADD CONSTRAINT "contests_status_check" CHECK ("status" IN ('EXPECTED','AUTHORIZED','NOTICE_PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','EXAM_DONE','FINISHED'));
ALTER TABLE "contests" ADD CONSTRAINT "contests_state_check" CHECK ("state_code" IS NULL OR "state_code" IN ('AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'));
ALTER TABLE "contests" ADD CONSTRAINT "contests_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "contests" ADD CONSTRAINT "contests_vacancies_check" CHECK ("vacancies" IS NULL OR "vacancies" >= 0);
ALTER TABLE "contests" ADD CONSTRAINT "contests_salary_check" CHECK (
  ("salary_min_cents" IS NULL OR "salary_min_cents" >= 0) AND
  ("salary_max_cents" IS NULL OR "salary_max_cents" >= 0) AND
  ("salary_min_cents" IS NULL OR "salary_max_cents" IS NULL OR "salary_min_cents" <= "salary_max_cents"));
ALTER TABLE "contests" ADD CONSTRAINT "contests_registration_check" CHECK ("registration_start" IS NULL OR "registration_end" IS NULL OR "registration_start" <= "registration_end");
ALTER TABLE "contests" ADD CONSTRAINT "contests_education_check" CHECK (COALESCE("education_levels", ARRAY[]::VARCHAR(20)[]) <@ ARRAY['FUNDAMENTAL','MEDIO','SUPERIOR']::VARCHAR(20)[]);
ALTER TABLE "contests" ADD CONSTRAINT "contests_notice_url_check" CHECK ("notice_url" IS NULL OR "notice_url" ~ '^https://');

-- Server-only; no policies (no Data API access).
ALTER TABLE "contests" ENABLE ROW LEVEL SECURITY;
