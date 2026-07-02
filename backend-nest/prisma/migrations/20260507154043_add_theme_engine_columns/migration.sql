/*
  Warnings:

  - You are about to drop the column `dropOffSlide` on the `ab_test_results` table. All the data in the column will be lost.
  - You are about to drop the column `engaged` on the `ab_test_results` table. All the data in the column will be lost.
  - You are about to drop the column `interactions` on the `ab_test_results` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `ab_test_results` table. All the data in the column will be lost.
  - You are about to drop the column `testId` on the `ab_test_results` table. All the data in the column will be lost.
  - You are about to drop the column `viewerId` on the `ab_test_results` table. All the data in the column will be lost.
  - You are about to drop the column `avgViewTime` on the `ab_test_variants` table. All the data in the column will be lost.
  - You are about to drop the column `bounceRate` on the `ab_test_variants` table. All the data in the column will be lost.
  - You are about to drop the column `conversions` on the `ab_test_variants` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `ab_test_variants` table. All the data in the column will be lost.
  - You are about to drop the column `engagementScore` on the `ab_test_variants` table. All the data in the column will be lost.
  - You are about to drop the column `impressions` on the `ab_test_variants` table. All the data in the column will be lost.
  - You are about to drop the column `themeConfig` on the `ab_test_variants` table. All the data in the column will be lost.
  - You are about to drop the column `traffic` on the `ab_test_variants` table. All the data in the column will be lost.
  - You are about to drop the column `confidenceLevel` on the `ab_tests` table. All the data in the column will be lost.
  - You are about to drop the column `currentSample` on the `ab_tests` table. All the data in the column will be lost.
  - You are about to drop the column `endedAt` on the `ab_tests` table. All the data in the column will be lost.
  - You are about to drop the column `goalMetric` on the `ab_tests` table. All the data in the column will be lost.
  - You are about to drop the column `sampleSize` on the `ab_tests` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `ab_tests` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ab_tests` table. All the data in the column will be lost.
  - You are about to drop the column `winnerVariantId` on the `ab_tests` table. All the data in the column will be lost.
  - Added the required column `content` to the `ab_test_variants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ab_test_variants` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ab_test_results" DROP CONSTRAINT "ab_test_results_testId_fkey";

-- DropIndex
DROP INDEX "ab_test_results_testId_idx";

-- DropIndex
DROP INDEX "ab_tests_status_idx";

-- DropIndex
DROP INDEX "ab_tests_userId_idx";

-- AlterTable
ALTER TABLE "ab_test_results" DROP COLUMN "dropOffSlide",
DROP COLUMN "engaged",
DROP COLUMN "interactions",
DROP COLUMN "metadata",
DROP COLUMN "testId",
DROP COLUMN "viewerId",
ADD COLUMN     "converted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "ab_test_variants" DROP COLUMN "avgViewTime",
DROP COLUMN "bounceRate",
DROP COLUMN "conversions",
DROP COLUMN "description",
DROP COLUMN "engagementScore",
DROP COLUMN "impressions",
DROP COLUMN "themeConfig",
DROP COLUMN "traffic",
ADD COLUMN     "content" JSONB NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "ab_tests" DROP COLUMN "confidenceLevel",
DROP COLUMN "currentSample",
DROP COLUMN "endedAt",
DROP COLUMN "goalMetric",
DROP COLUMN "sampleSize",
DROP COLUMN "startedAt",
DROP COLUMN "userId",
DROP COLUMN "winnerVariantId",
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "themes" ADD COLUMN     "customReferenceImageUrl" TEXT,
ADD COLUMN     "styleSeed" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "generation_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentAgent" TEXT,
    "qualityScore" INTEGER,
    "tokenUsage" JSONB NOT NULL DEFAULT '{}',
    "agentOutputs" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "request" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edit_memory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "blockId" TEXT,
    "field" TEXT NOT NULL,
    "previousValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edit_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generation_sessions_projectId_idx" ON "generation_sessions"("projectId");

-- CreateIndex
CREATE INDEX "generation_sessions_userId_idx" ON "generation_sessions"("userId");

-- CreateIndex
CREATE INDEX "generation_sessions_status_idx" ON "generation_sessions"("status");

-- CreateIndex
CREATE INDEX "generation_sessions_createdAt_idx" ON "generation_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "edit_memory_projectId_idx" ON "edit_memory"("projectId");

-- CreateIndex
CREATE INDEX "edit_memory_slideId_idx" ON "edit_memory"("slideId");

-- CreateIndex
CREATE INDEX "edit_memory_pinned_idx" ON "edit_memory"("pinned");

-- CreateIndex
CREATE INDEX "themes_userId_idx" ON "themes"("userId");

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
