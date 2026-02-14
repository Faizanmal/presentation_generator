-- Migration: Add Enhanced Block Support
-- Description: Adds columns and types to support enhanced blocks with charts, emojis, and rich styling
-- Created: 2026-02-09

-- 1. Add new block types to the BlockType enum (if using Prisma, update schema.prisma)
-- This should be done in your Prisma schema file:
/*
enum BlockType {
  // Existing types
  TEXT
  IMAGE
  VIDEO
  EMBED
  
  // New enhanced types
  HEADING
  SUBHEADING
  PARAGRAPH
  BULLET_LIST
  NUMBERED_LIST
  CARD
  QUOTE
  CHART
  LOGO
  LOGO_GRID
  CALLOUT
  DIVIDER
  CODE
  TABLE
}
*/

-- 2. Add chartData column to Block table
ALTER TABLE "Block" 
ADD COLUMN IF NOT EXISTS "chartData" JSONB DEFAULT NULL;

-- 3. Add emoji column to Block table
ALTER TABLE "Block" 
ADD COLUMN IF NOT EXISTS "emoji" VARCHAR(10) DEFAULT NULL;

-- 4. Add variant column for card styles
ALTER TABLE "Block" 
ADD COLUMN IF NOT EXISTS "variant" VARCHAR(50) DEFAULT 'default';

-- 5. Create index on chartData for faster queries
CREATE INDEX IF NOT EXISTS "idx_block_chart_data" 
ON "Block" USING GIN ("chartData");

-- 6. Create SearchCache table for caching search results
CREATE TABLE IF NOT EXISTS "SearchCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "query" TEXT NOT NULL,
  "provider" TEXT NOT NULL, -- 'google' or 'bing'
  "results" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "hitCount" INTEGER NOT NULL DEFAULT 0
);

-- 7. Create index on SearchCache query
CREATE INDEX IF NOT EXISTS "idx_search_cache_query" 
ON "SearchCache" ("query", "provider");

-- 8. Create index on SearchCache expiresAt
CREATE INDEX IF NOT EXISTS "idx_search_cache_expires" 
ON "SearchCache" ("expiresAt");

-- 9. Add apiUsage tracking table
CREATE TABLE IF NOT EXISTS "APIUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL, -- 'google', 'bing', 'openai', etc.
  "endpoint" TEXT NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  "cost" DECIMAL(10, 4) DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "APIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- 10. Create index on APIUsage for analytics
CREATE INDEX IF NOT EXISTS "idx_api_usage_user" 
ON "APIUsage" ("userId", "createdAt");

-- 11. Create index on APIUsage for provider stats
CREATE INDEX IF NOT EXISTS "idx_api_usage_provider" 
ON "APIUsage" ("provider", "createdAt");

-- 12. Add feature flags to Organization/User table (optional)
ALTER TABLE "Organization" 
ADD COLUMN IF NOT EXISTS "features" JSONB DEFAULT '{"realTimeData": true, "charts": true, "emojis": true, "cardStyles": true}'::jsonb;

-- 13. Add comment for documentation
COMMENT ON COLUMN "Block"."chartData" IS 'Stores Chart.js configuration and real-time data for chart blocks';
COMMENT ON COLUMN "Block"."emoji" IS 'Emoji character to display with content';
COMMENT ON COLUMN "Block"."variant" IS 'Style variant: default, info, success, warning, error';
COMMENT ON TABLE "SearchCache" IS 'Caches search API results to reduce API calls and costs';
COMMENT ON TABLE "APIUsage" IS 'Tracks API usage for billing and monitoring';

-- 14. Create function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM "SearchCache" WHERE "expiresAt" < NOW();
END;
$$ LANGUAGE plpgsql;

-- 15. Create scheduled job to clean cache (requires pg_cron extension)
-- Run this if you have pg_cron installed:
-- SELECT cron.schedule('clean-search-cache', '0 */6 * * *', 'SELECT clean_expired_cache()');

-- ============================================
-- Rollback Script (if needed)
-- ============================================

/*
-- To rollback this migration:

DROP TABLE IF EXISTS "APIUsage" CASCADE;
DROP TABLE IF EXISTS "SearchCache" CASCADE;
DROP FUNCTION IF EXISTS clean_expired_cache();

ALTER TABLE "Block" 
DROP COLUMN IF EXISTS "chartData",
DROP COLUMN IF EXISTS "emoji",
DROP COLUMN IF EXISTS "variant";

ALTER TABLE "Organization" 
DROP COLUMN IF EXISTS "features";

-- Note: Rolling back enum changes in Prisma requires updating schema.prisma
-- and running `prisma migrate dev`
*/
