-- More contest details (fee, stages, exam locations, authorization act) and positions per contest. Additive.
-- AlterTable
ALTER TABLE "contests" ADD COLUMN     "authorization" VARCHAR(300),
ADD COLUMN     "exam_locations" VARCHAR(300),
ADD COLUMN     "fee_text" VARCHAR(120),
ADD COLUMN     "stages" VARCHAR(2000) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "contest_positions" (
    "id" UUID NOT NULL,
    "contest_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "vacancies" INTEGER,
    "has_reserve_list" BOOLEAN NOT NULL DEFAULT false,
    "salary_cents" INTEGER,
    "education_level" VARCHAR(20),
    "requirements" VARCHAR(500) NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contest_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contest_positions_contest_id_sort_order_idx" ON "contest_positions"("contest_id", "sort_order");

-- AddForeignKey
ALTER TABLE "contest_positions" ADD CONSTRAINT "contest_positions_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "contest_positions" ADD CONSTRAINT "contest_positions_vacancies_check" CHECK ("vacancies" IS NULL OR "vacancies" >= 0);
ALTER TABLE "contest_positions" ADD CONSTRAINT "contest_positions_salary_check" CHECK ("salary_cents" IS NULL OR "salary_cents" >= 0);
ALTER TABLE "contest_positions" ADD CONSTRAINT "contest_positions_education_check" CHECK ("education_level" IS NULL OR "education_level" IN ('FUNDAMENTAL','MEDIO','SUPERIOR'));

-- Server-only; no policies (no Data API access).
ALTER TABLE "contest_positions" ENABLE ROW LEVEL SECURITY;
