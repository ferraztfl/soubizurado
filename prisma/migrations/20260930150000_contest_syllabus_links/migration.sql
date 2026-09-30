-- Explicit link of a syllabus subject to an area or topic of the taxonomy (practice filters). Additive.
-- AlterTable
ALTER TABLE "contest_syllabus_subjects" ADD COLUMN     "area_id" UUID,
ADD COLUMN     "topic_id" UUID;

-- AddForeignKey
ALTER TABLE "contest_syllabus_subjects" ADD CONSTRAINT "contest_syllabus_subjects_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_syllabus_subjects" ADD CONSTRAINT "contest_syllabus_subjects_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A subject links to an area or to a topic, never both.
ALTER TABLE "contest_syllabus_subjects" ADD CONSTRAINT "contest_syllabus_subjects_link_check" CHECK ("area_id" IS NULL OR "topic_id" IS NULL);
