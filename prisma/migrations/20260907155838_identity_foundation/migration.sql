-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('STUDENT', 'EDITOR', 'MODERATOR', 'ADMIN');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "display_name" VARCHAR(120),
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "role" "AppRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_auth_user_id_key" ON "profiles"("auth_user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_profile_id_role_key" ON "user_roles"("profile_id", "role");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
