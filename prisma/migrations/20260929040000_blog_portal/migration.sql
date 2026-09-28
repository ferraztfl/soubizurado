-- Blog portal: post format (news / article), state (UF) and featured flag; category groups and icons;
-- newsletter sign-ups; default editorials. Additive migration: new columns with defaults, one new table, seed rows.
-- AlterTable
ALTER TABLE "blog_categories" ADD COLUMN     "description" VARCHAR(300),
ADD COLUMN     "group_key" VARCHAR(20) NOT NULL DEFAULT 'GERAL',
ADD COLUMN     "icon" VARCHAR(30),
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "format" VARCHAR(20) NOT NULL DEFAULT 'NEWS',
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state_code" CHAR(2);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "source" VARCHAR(60) NOT NULL DEFAULT 'blog',
    "consent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE INDEX "blog_posts_state_code_published_at_idx" ON "blog_posts"("state_code", "published_at");

-- CreateIndex
CREATE INDEX "blog_posts_is_featured_published_at_idx" ON "blog_posts"("is_featured", "published_at");


-- Guard values also at the database level.
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_format_check" CHECK ("format" IN ('NEWS', 'ARTICLE'));
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_state_check" CHECK ("state_code" IS NULL OR "state_code" IN ('AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'));
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_group_check" CHECK ("group_key" IN ('CARREIRA', 'EXAME', 'GERAL'));
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_email_check" CHECK ("email" = lower("email") AND "email" LIKE '%_@_%._%');

-- Server-only; no policies (no Data API access).
ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;

-- Default editorials (existing slugs are kept as they are).
INSERT INTO "blog_categories" ("id", "slug", "name", "group_key", "icon", "sort_order") VALUES
  (gen_random_uuid(), 'policial', 'Policial', 'CARREIRA', 'badge', 10),
  (gen_random_uuid(), 'fiscal', 'Fiscal', 'CARREIRA', 'chart', 20),
  (gen_random_uuid(), 'tribunais', 'Tribunais', 'CARREIRA', 'scales', 30),
  (gen_random_uuid(), 'juridico', 'Jurídico', 'CARREIRA', 'gavel', 40),
  (gen_random_uuid(), 'educacao', 'Educação', 'CARREIRA', 'cap', 50),
  (gen_random_uuid(), 'militar', 'Militar', 'CARREIRA', 'medal', 60),
  (gen_random_uuid(), 'saude', 'Saúde', 'CARREIRA', 'health', 70),
  (gen_random_uuid(), 'ti', 'TI', 'CARREIRA', 'monitor', 80),
  (gen_random_uuid(), 'administrativo', 'Administrativo', 'CARREIRA', 'briefcase', 90),
  (gen_random_uuid(), 'bancario', 'Bancário', 'CARREIRA', 'bank', 100),
  (gen_random_uuid(), 'legislativo', 'Legislativo', 'CARREIRA', 'building', 110),
  (gen_random_uuid(), 'oab', 'OAB — Exame de Ordem', 'EXAME', 'scales', 10),
  (gen_random_uuid(), 'enem', 'ENEM', 'EXAME', 'pencil', 20),
  (gen_random_uuid(), 'residencia-em-saude', 'Residência em Saúde', 'EXAME', 'health', 30),
  (gen_random_uuid(), 'cfc', 'CFC — Exame de Suficiência', 'EXAME', 'chart', 40),
  (gen_random_uuid(), 'editais', 'Editais', 'GERAL', 'megaphone', 10),
  (gen_random_uuid(), 'dicas-de-estudo', 'Dicas de estudo', 'GERAL', 'bulb', 20)
ON CONFLICT ("slug") DO NOTHING;
