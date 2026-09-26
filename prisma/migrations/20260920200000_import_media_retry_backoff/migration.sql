-- Schedule media retries with exponential backoff.
-- Additive migration: existing tasks remain immediately eligible.

ALTER TABLE "import_media_tasks"
ADD COLUMN "next_attempt_at" TIMESTAMPTZ(6);

CREATE INDEX "import_media_tasks_status_next_attempt_at_created_at_idx"
ON "import_media_tasks" (
  "status",
  "next_attempt_at",
  "created_at"
);
