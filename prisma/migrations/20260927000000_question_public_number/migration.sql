-- Short public code for questions, shown as "Q100001".
-- Additive migration: one new column filled for existing rows in
-- creation order, then fed by a sequence for new questions.

CREATE SEQUENCE "questions_public_number_seq" START WITH 100001;

ALTER TABLE "questions" ADD COLUMN "public_number" INTEGER;

UPDATE "questions" AS q
SET "public_number" = numbered.n
FROM (
  SELECT "id", 100000 + row_number() OVER (ORDER BY "created_at", "id") AS n
  FROM "questions"
) AS numbered
WHERE q."id" = numbered."id";

SELECT setval('"questions_public_number_seq"', COALESCE((SELECT max("public_number") FROM "questions"), 100000), (SELECT count(*) > 0 FROM "questions"));

ALTER TABLE "questions" ALTER COLUMN "public_number" SET DEFAULT nextval('"questions_public_number_seq"');
ALTER TABLE "questions" ALTER COLUMN "public_number" SET NOT NULL;
ALTER SEQUENCE "questions_public_number_seq" OWNED BY "questions"."public_number";

CREATE UNIQUE INDEX "questions_public_number_key" ON "questions"("public_number");
