-- Optional wide banner for offers (home page carousel). Additive: one nullable column.
-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "banner_asset_id" UUID;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_banner_asset_id_fkey" FOREIGN KEY ("banner_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

