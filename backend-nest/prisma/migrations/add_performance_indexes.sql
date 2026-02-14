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
