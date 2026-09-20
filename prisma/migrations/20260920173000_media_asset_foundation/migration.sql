-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "storage_provider" VARCHAR(40) NOT NULL,
    "bucket" VARCHAR(160) NOT NULL,
    "storage_key" VARCHAR(700) NOT NULL,
    "mime_type" VARCHAR(160) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" TEXT,
    "checksum" CHAR(64) NOT NULL,
    "source_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_assets_size_bytes_check" CHECK ("size_bytes" >= 0),
    CONSTRAINT "media_assets_width_check" CHECK ("width" IS NULL OR "width" > 0),
    CONSTRAINT "media_assets_height_check" CHECK ("height" IS NULL OR "height" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key"
ON "media_assets"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_checksum_key"
ON "media_assets"("checksum");

-- CreateIndex
CREATE INDEX "media_assets_storage_provider_bucket_idx"
ON "media_assets"("storage_provider", "bucket");

-- CreateIndex
CREATE INDEX "media_assets_mime_type_idx"
ON "media_assets"("mime_type");

-- CreateTable
CREATE TABLE "import_item_media_links" (
    "id" UUID NOT NULL,
    "import_item_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "role" VARCHAR(40) NOT NULL,
    "alternative_label" VARCHAR(8),
    "position" INTEGER NOT NULL,
    "page" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_item_media_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "import_item_media_links_position_check" CHECK ("position" >= 0),
    CONSTRAINT "import_item_media_links_page_check" CHECK ("page" IS NULL OR "page" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "import_item_media_links_item_asset_role_position_key"
ON "import_item_media_links"("import_item_id", "media_asset_id", "role", "position");

-- CreateIndex
CREATE INDEX "import_item_media_links_item_role_position_idx"
ON "import_item_media_links"("import_item_id", "role", "position");

-- CreateIndex
CREATE INDEX "import_item_media_links_media_asset_id_idx"
ON "import_item_media_links"("media_asset_id");

-- CreateTable
CREATE TABLE "question_media_links" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "role" VARCHAR(40) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_media_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "question_media_links_position_check" CHECK ("position" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "question_media_links_question_role_position_key"
ON "question_media_links"("question_id", "role", "position");

-- CreateIndex
CREATE INDEX "question_media_links_media_asset_id_idx"
ON "question_media_links"("media_asset_id");

-- CreateTable
CREATE TABLE "question_alternative_media_links" (
    "id" UUID NOT NULL,
    "alternative_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_alternative_media_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "question_alternative_media_links_position_check" CHECK ("position" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "question_alternative_media_links_alternative_position_key"
ON "question_alternative_media_links"("alternative_id", "position");

-- CreateIndex
CREATE INDEX "question_alternative_media_links_media_asset_id_idx"
ON "question_alternative_media_links"("media_asset_id");

-- AddForeignKey
ALTER TABLE "import_item_media_links"
ADD CONSTRAINT "import_item_media_links_import_item_id_fkey"
FOREIGN KEY ("import_item_id") REFERENCES "import_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_item_media_links"
ADD CONSTRAINT "import_item_media_links_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_media_links"
ADD CONSTRAINT "question_media_links_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "questions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_media_links"
ADD CONSTRAINT "question_media_links_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_alternative_media_links"
ADD CONSTRAINT "question_alternative_media_links_alternative_id_fkey"
FOREIGN KEY ("alternative_id") REFERENCES "question_alternatives"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_alternative_media_links"
ADD CONSTRAINT "question_alternative_media_links_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable Row Level Security
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_item_media_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_media_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_alternative_media_links" ENABLE ROW LEVEL SECURITY;
