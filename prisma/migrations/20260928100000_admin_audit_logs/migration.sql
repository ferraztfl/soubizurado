-- Audit trail of sensitive backoffice actions on accounts (invite, role change, block).
-- Additive migration: one new table. Existing rows untouched.
-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_profile_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "target_profile_id" UUID,
    "target_auth_user_id" UUID,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_profile_id_created_at_idx" ON "admin_audit_logs"("target_profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Written only by server actions (requireAdminUser) through the database owner;
-- no policies: nothing is readable or writable through the Data API.
ALTER TABLE "admin_audit_logs" ENABLE ROW LEVEL SECURITY;
