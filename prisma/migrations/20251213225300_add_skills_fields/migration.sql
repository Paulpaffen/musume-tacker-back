-- AlterTable
ALTER TABLE "character_trainings" ADD COLUMN "unique_skill_level" INTEGER;
ALTER TABLE "character_trainings" ADD COLUMN "skills" JSONB;
