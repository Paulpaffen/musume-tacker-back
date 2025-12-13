-- AlterTable
ALTER TABLE "character_trainings" ADD COLUMN "speed" INTEGER DEFAULT 0;
ALTER TABLE "character_trainings" ADD COLUMN "stamina" INTEGER DEFAULT 0;
ALTER TABLE "character_trainings" ADD COLUMN "power" INTEGER DEFAULT 0;
ALTER TABLE "character_trainings" ADD COLUMN "guts" INTEGER DEFAULT 0;
ALTER TABLE "character_trainings" ADD COLUMN "wit" INTEGER DEFAULT 0;
ALTER TABLE "character_trainings" ADD COLUMN "rank" TEXT;
