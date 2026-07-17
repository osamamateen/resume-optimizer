/*
  Warnings:

  - Added the required column `originalAtsScore` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalMatchedKeywords` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalMissingKeywords` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalSections` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `suggestionsBullets` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `suggestionsHeadline` to the `Application` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "originalAtsScore" INTEGER NOT NULL,
ADD COLUMN     "originalMatchedKeywords" JSONB NOT NULL,
ADD COLUMN     "originalMissingKeywords" JSONB NOT NULL,
ADD COLUMN     "originalSections" JSONB NOT NULL,
ADD COLUMN     "suggestionsBullets" JSONB NOT NULL,
ADD COLUMN     "suggestionsHeadline" TEXT NOT NULL,
ALTER COLUMN "resumeData" DROP NOT NULL,
ALTER COLUMN "summaryHeadline" DROP NOT NULL,
ALTER COLUMN "summaryBullets" DROP NOT NULL;
