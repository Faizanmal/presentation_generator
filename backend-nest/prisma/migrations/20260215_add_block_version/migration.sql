-- AddBlockVersionForOptimisticLocking
-- Add version field to blocks table for optimistic locking and conflict resolution

-- Step 1: Add version column with default value of 1
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blocks' AND column_name = 'version') THEN
        ALTER TABLE "blocks" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Step 2: Create index for efficient version queries
CREATE INDEX IF NOT EXISTS "idx_blocks_project_version" ON "blocks"("projectId", "version");

-- Step 3: Update existing blocks to have version 1 (already done by DEFAULT)

-- Step 4: Add comment for documentation
COMMENT ON COLUMN "blocks"."version" IS 'Optimistic locking version for conflict detection in collaborative editing';
