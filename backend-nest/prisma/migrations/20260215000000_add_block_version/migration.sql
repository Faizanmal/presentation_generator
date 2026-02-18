-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blocks' AND column_name = 'version') THEN
        ALTER TABLE "blocks" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "blocks_projectId_version_idx" ON "blocks"("projectId", "version");
