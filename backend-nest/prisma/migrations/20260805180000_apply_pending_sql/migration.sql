-- Persist canonical AI PresentationDocument (includes editMemory) on projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dslDocument" JSONB;
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
-- AI Generation Pipeline Schema Extension
-- Adds generation state, edit memory, and quality tracking to presentations

-- Generation sessions table (tracks each pipeline execution)
CREATE TABLE IF NOT EXISTS "generation_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    
    CONSTRAINT "generation_sessions_projectId_fkey" 
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE,
    CONSTRAINT "generation_sessions_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "generation_sessions_projectId_idx" ON "generation_sessions"("projectId");
CREATE INDEX IF NOT EXISTS "generation_sessions_userId_idx" ON "generation_sessions"("userId");
CREATE INDEX IF NOT EXISTS "generation_sessions_status_idx" ON "generation_sessions"("status");
CREATE INDEX IF NOT EXISTS "generation_sessions_createdAt_idx" ON "generation_sessions"("createdAt");

-- Edit memory table (stores user corrections for partial regeneration)
CREATE TABLE IF NOT EXISTS "edit_memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "blockId" TEXT,
    "field" TEXT NOT NULL,
    "previousValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "edit_memory_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "edit_memory_projectId_idx" ON "edit_memory"("projectId");
CREATE INDEX IF NOT EXISTS "edit_memory_slideId_idx" ON "edit_memory"("slideId");
CREATE INDEX IF NOT EXISTS "edit_memory_pinned_idx" ON "edit_memory"("pinned");

-- Slide quality metadata
ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "aiConfidence" DOUBLE PRECISION DEFAULT 0.7;
ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "userEdited" BOOLEAN DEFAULT false;
ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "narrativeRole" TEXT DEFAULT 'context';
ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "storybeat" JSONB;

-- Project generation metadata
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "generationSessionId" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "narrativeArc" TEXT;

-- Slide layout metadata
ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "layoutPreset" TEXT DEFAULT 'single-column';
ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "layoutDensity" TEXT DEFAULT 'balanced';
ALTER TABLE "slides" ADD COLUMN IF NOT EXISTS "layoutZones" INTEGER DEFAULT 1;

-- Block source tracking
ALTER TABLE "blocks" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'user';
ALTER TABLE "blocks" ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN DEFAULT false;
ALTER TABLE "blocks" ADD COLUMN IF NOT EXISTS "generationPrompt" TEXT;
ALTER TABLE "blocks" ADD COLUMN IF NOT EXISTS "zone" INTEGER DEFAULT 0;

-- Performance indexes for generation queries
CREATE INDEX IF NOT EXISTS "slides_narrativeRole_idx" ON "slides"("narrativeRole");
CREATE INDEX IF NOT EXISTS "blocks_source_idx" ON "blocks"("source");
CREATE INDEX IF NOT EXISTS "blocks_pinned_idx" ON "blocks"("pinned");
-- Database Indexes Migration
-- This migration adds indexes to improve query performance on frequently accessed columns

-- User indexes for common queries
CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX IF NOT EXISTS "users_emailVerified_idx" ON "users"("emailVerified");
CREATE INDEX IF NOT EXISTS "users_subscriptionTier_idx" ON "users"("subscriptionTier");
CREATE INDEX IF NOT EXISTS "users_subscriptionStatus_idx" ON "users"("subscriptionStatus");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");

-- Account indexes
CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("userId");
CREATE INDEX IF NOT EXISTS "accounts_provider_idx" ON "accounts"("provider");

-- Session indexes
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions"("expires");

-- Project indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS "projects_createdAt_idx" ON "projects"("createdAt");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status");
CREATE INDEX IF NOT EXISTS "projects_visibility_idx" ON "projects"("visibility");
CREATE INDEX IF NOT EXISTS "projects_themeId_idx" ON "projects"("themeId");
CREATE INDEX IF NOT EXISTS "projects_approvalStatus_idx" ON "projects"("approvalStatus");
CREATE INDEX IF NOT EXISTS "projects_ownerId_createdAt_idx" ON "projects"("ownerId", "createdAt" DESC);

-- Slide indexes
CREATE INDEX IF NOT EXISTS "slides_createdAt_idx" ON "slides"("createdAt");
CREATE INDEX IF NOT EXISTS "slides_projectId_order_idx" ON "slides"("projectId", "order");

-- Block indexes  
CREATE INDEX IF NOT EXISTS "blocks_createdAt_idx" ON "blocks"("createdAt");
CREATE INDEX IF NOT EXISTS "blocks_type_idx" ON "blocks"("type");

-- Theme indexes
CREATE INDEX IF NOT EXISTS "themes_isPublic_idx" ON "themes"("isPublic");
CREATE INDEX IF NOT EXISTS "themes_category_idx" ON "themes"("category");
CREATE INDEX IF NOT EXISTS "themes_userId_idx" ON "themes"("userId");

-- Subscription indexes
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx" ON "subscriptions"("plan");
CREATE INDEX IF NOT EXISTS "subscriptions_currentPeriodEnd_idx" ON "subscriptions"("currentPeriodEnd");

-- AI Generation indexes
CREATE INDEX IF NOT EXISTS "ai_generations_createdAt_idx" ON "ai_generations"("createdAt");
CREATE INDEX IF NOT EXISTS "ai_generations_model_idx" ON "ai_generations"("model");
CREATE INDEX IF NOT EXISTS "ai_generations_userId_createdAt_idx" ON "ai_generations"("userId", "createdAt" DESC);

-- Asset indexes
CREATE INDEX IF NOT EXISTS "assets_createdAt_idx" ON "assets"("createdAt");
CREATE INDEX IF NOT EXISTS "assets_mimeType_idx" ON "assets"("mimeType");

-- Collaboration indexes
CREATE INDEX IF NOT EXISTS "collaboration_sessions_isActive_idx" ON "collaboration_sessions"("isActive");
CREATE INDEX IF NOT EXISTS "collaboration_sessions_startedAt_idx" ON "collaboration_sessions"("startedAt");

-- Comment indexes
CREATE INDEX IF NOT EXISTS "comments_userId_idx" ON "comments"("userId");
CREATE INDEX IF NOT EXISTS "comments_resolved_idx" ON "comments"("resolved");
CREATE INDEX IF NOT EXISTS "comments_createdAt_idx" ON "comments"("createdAt");
CREATE INDEX IF NOT EXISTS "comments_parentId_idx" ON "comments"("parentId");

-- VoiceRecording indexes
CREATE INDEX IF NOT EXISTS "voice_recordings_status_idx" ON "voice_recordings"("status");
CREATE INDEX IF NOT EXISTS "voice_recordings_createdAt_idx" ON "voice_recordings"("createdAt");

-- Analytics indexes
CREATE INDEX IF NOT EXISTS "presentation_views_startedAt_idx" ON "presentation_views"("startedAt");
CREATE INDEX IF NOT EXISTS "presentation_views_viewerId_idx" ON "presentation_views"("viewerId");
CREATE INDEX IF NOT EXISTS "slide_views_slideIndex_idx" ON "slide_views"("slideIndex");
CREATE INDEX IF NOT EXISTS "slide_views_enterTime_idx" ON "slide_views"("enterTime");
CREATE INDEX IF NOT EXISTS "analytics_snapshots_date_idx" ON "analytics_snapshots"("date");

-- Integration indexes
CREATE INDEX IF NOT EXISTS "integrations_provider_idx" ON "integrations"("provider");
CREATE INDEX IF NOT EXISTS "integrations_isActive_idx" ON "integrations"("isActive");
CREATE INDEX IF NOT EXISTS "integrations_createdAt_idx" ON "integrations"("createdAt");
CREATE INDEX IF NOT EXISTS "integration_webhooks_status_idx" ON "integration_webhooks"("status");
CREATE INDEX IF NOT EXISTS "integration_webhooks_createdAt_idx" ON "integration_webhooks"("createdAt");

-- BrandProfile index
CREATE INDEX IF NOT EXISTS "brand_profiles_userId_idx" ON "brand_profiles"("userId");

-- TrainingDocument indexes
CREATE INDEX IF NOT EXISTS "training_documents_status_idx" ON "training_documents"("status");
CREATE INDEX IF NOT EXISTS "training_documents_createdAt_idx" ON "training_documents"("createdAt");

-- AIPersonalization index
CREATE INDEX IF NOT EXISTS "ai_personalizations_projectId_idx" ON "ai_personalizations"("projectId");

-- Organization indexes
CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations"("slug");
CREATE INDEX IF NOT EXISTS "organizations_domain_idx" ON "organizations"("domain");
CREATE INDEX IF NOT EXISTS "organizations_createdAt_idx" ON "organizations"("createdAt");

-- SSOConfig index
CREATE INDEX IF NOT EXISTS "sso_configs_organizationId_idx" ON "sso_configs"("organizationId");
CREATE INDEX IF NOT EXISTS "sso_configs_isActive_idx" ON "sso_configs"("isActive");

-- AuditLog indexes
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs"("resource");
CREATE INDEX IF NOT EXISTS "audit_logs_resourceId_idx" ON "audit_logs"("resourceId");

-- TeamInvitation indexes
CREATE INDEX IF NOT EXISTS "team_invitations_token_idx" ON "team_invitations"("token");
CREATE INDEX IF NOT EXISTS "team_invitations_expiresAt_idx" ON "team_invitations"("expiresAt");

-- OfflineCache index
CREATE INDEX IF NOT EXISTS "offline_caches_lastSynced_idx" ON "offline_caches"("lastSynced");
CREATE INDEX IF NOT EXISTS "offline_caches_pendingSync_idx" ON "offline_caches"("pendingSync");

-- SyncQueue indexes
CREATE INDEX IF NOT EXISTS "sync_queue_createdAt_idx" ON "sync_queue"("createdAt");
CREATE INDEX IF NOT EXISTS "sync_queue_priority_idx" ON "sync_queue"("priority");
CREATE INDEX IF NOT EXISTS "sync_queue_attempts_idx" ON "sync_queue"("attempts");

-- Tag indexes
CREATE INDEX IF NOT EXISTS "tags_name_idx" ON "tags"("name");
CREATE INDEX IF NOT EXISTS "tags_createdAt_idx" ON "tags"("createdAt");

-- Webhook indexes
CREATE INDEX IF NOT EXISTS "webhooks_createdAt_idx" ON "webhooks"("createdAt");
CREATE INDEX IF NOT EXISTS "webhooks_lastTriggeredAt_idx" ON "webhooks"("lastTriggeredAt");

-- EmailPreferences index
CREATE INDEX IF NOT EXISTS "email_preferences_userId_idx" ON "email_preferences"("userId");

-- ActivityLog indexes (if exists)
-- CREATE INDEX IF NOT EXISTS "activity_logs_userId_idx" ON "activity_logs"("userId");
-- CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
-- CREATE INDEX IF NOT EXISTS "activity_logs_action_idx" ON "activity_logs"("action");
