-- Optional organization logo for contests (cards and contest page). Additive: one nullable column.
-- AlterTable
ALTER TABLE "contests" ADD COLUMN     "logo_asset_id" UUID;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_logo_asset_id_fkey" FOREIGN KEY ("logo_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

