-- Ranking aggregates every answer of a period: index by answer time.
-- Additive migration: one new index.
-- CreateIndex
CREATE INDEX "study_answer_attempts_answered_at_idx" ON "study_answer_attempts"("answered_at");

