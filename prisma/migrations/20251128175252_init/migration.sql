-- CreateEnum
CREATE TYPE "TrackType" AS ENUM ('TURF_SHORT', 'TURF_MILE', 'TURF_MEDIUM', 'TURF_LONG', 'DIRT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_trainings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "character_name" TEXT NOT NULL,
    "identifier_version" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "character_training_id" TEXT NOT NULL,
    "track_type" "TrackType" NOT NULL,
    "final_place" INTEGER NOT NULL,
    "rare_skills_count" INTEGER NOT NULL DEFAULT 0,
    "normal_skills_count" INTEGER NOT NULL DEFAULT 0,
    "unique_skill_activated" BOOLEAN NOT NULL DEFAULT false,
    "good_positioning" BOOLEAN NOT NULL DEFAULT false,
    "rushed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "character_trainings" ADD CONSTRAINT "character_trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_character_training_id_fkey" FOREIGN KEY ("character_training_id") REFERENCES "character_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
