-- Optional image on top of an offer card in the store. Additive.
-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "card_image_asset_id" UUID;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_card_image_asset_id_fkey" FOREIGN KEY ("card_image_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
