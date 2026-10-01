-- Leads: people who request a free material (edital verticalizado PDF) with name, e-mail and WhatsApp. Additive.
-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "whatsapp" VARCHAR(20) NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'SYLLABUS_PDF',
    "syllabus_id" UUID,
    "source_label" VARCHAR(240) NOT NULL,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent_at" TIMESTAMPTZ(6),
    "unsubscribed_at" TIMESTAMPTZ(6),
    "ip_hash" CHAR(64),
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "last_download_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_ip_hash_created_at_idx" ON "leads"("ip_hash", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_syllabus_id_key" ON "leads"("email", "syllabus_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "contest_syllabi"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guard values also at the database level.
ALTER TABLE "leads" ADD CONSTRAINT "leads_whatsapp_check" CHECK ("whatsapp" ~ '^[0-9]{10,13}$');
ALTER TABLE "leads" ADD CONSTRAINT "leads_downloads_check" CHECK ("downloads" >= 0);
ALTER TABLE "leads" ADD CONSTRAINT "leads_consent_check" CHECK ("marketing_consent" = ("marketing_consent_at" IS NOT NULL));

-- Server-only; no policies (no Data API access): personal data never reaches the browser client.
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
