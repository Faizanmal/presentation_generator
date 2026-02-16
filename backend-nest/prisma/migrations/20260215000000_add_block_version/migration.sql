-- CreateIndex
CREATE INDEX "blocks_projectId_version_idx" ON "blocks"("projectId", "version");

-- AlterTable
ALTER TABLE "blocks" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
