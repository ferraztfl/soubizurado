-- Make import-item media identity stable for both question-level
-- and alternative-level media.

UPDATE "import_item_media_links"
SET "alternative_label" = ''
WHERE "alternative_label" IS NULL;

ALTER TABLE "import_item_media_links"
ALTER COLUMN "alternative_label"
SET DEFAULT '';

ALTER TABLE "import_item_media_links"
ALTER COLUMN "alternative_label"
SET NOT NULL;

DROP INDEX IF EXISTS
"import_item_media_links_item_asset_role_position_key";

CREATE UNIQUE INDEX
"import_item_media_links_item_asset_role_alt_position_key"
ON "import_item_media_links"(
    "import_item_id",
    "media_asset_id",
    "role",
    "alternative_label",
    "position"
);