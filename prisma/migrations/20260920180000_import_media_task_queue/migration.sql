-- Persistent asynchronous media ingestion queue.
-- Additive migration. Existing questions and media remain untouched.

CREATE TYPE "ImportMediaTaskStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

CREATE TABLE "import_media_tasks" (
    "id" UUID NOT NULL,
    "import_item_id" UUID NOT NULL,
    "question_id" UUID,
    "media_asset_id" UUID,
    "source_url" TEXT NOT NULL,
    "role" VARCHAR(40) NOT NULL,
    "alternative_label" VARCHAR(8) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "status" "ImportMediaTaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_media_tasks_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "import_media_tasks_position_check"
        CHECK ("position" >= 0),

    CONSTRAINT "import_media_tasks_attempts_check"
        CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX
    "import_media_tasks_item_role_alt_position_key"
ON "import_media_tasks"(
    "import_item_id",
    "role",
    "alternative_label",
    "position"
);

CREATE INDEX
    "import_media_tasks_status_created_at_idx"
ON "import_media_tasks"(
    "status",
    "created_at"
);

CREATE INDEX
    "import_media_tasks_question_id_idx"
ON "import_media_tasks"("question_id");

CREATE INDEX
    "import_media_tasks_media_asset_id_idx"
ON "import_media_tasks"("media_asset_id");

ALTER TABLE "import_media_tasks"
ADD CONSTRAINT
    "import_media_tasks_import_item_id_fkey"
FOREIGN KEY ("import_item_id")
REFERENCES "import_items"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "import_media_tasks"
ADD CONSTRAINT
    "import_media_tasks_question_id_fkey"
FOREIGN KEY ("question_id")
REFERENCES "questions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "import_media_tasks"
ADD CONSTRAINT
    "import_media_tasks_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id")
REFERENCES "media_assets"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "import_media_tasks"
ENABLE ROW LEVEL SECURITY;