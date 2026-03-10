-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "details" JSONB,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "resourceType" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "severity" TEXT,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "blocks" ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "presentationId" TEXT;

-- AlterTable
ALTER TABLE "presentation_views" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "completionRate" DOUBLE PRECISION,
ADD COLUMN     "converted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "currentSlide" INTEGER,
ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "interacted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "project_collaborators" ADD COLUMN     "accessLevel" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "slides" ADD COLUMN     "presentationId" TEXT;

-- AlterTable
ALTER TABLE "video_export_jobs" ADD COLUMN     "duration" DOUBLE PRECISION,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "platform" TEXT,
    "appVersion" TEXT,
    "osVersion" TEXT,
    "deviceModel" TEXT,
    "screenWidth" INTEGER,
    "screenHeight" INTEGER,
    "isOfflineCapable" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastActive" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "platform" TEXT,
    "appVersion" TEXT,
    "pushToken" TEXT,
    "screenWidth" INTEGER,
    "screenHeight" INTEGER,
    "lastActive" TIMESTAMP(3),

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB,
    "auth" TEXT,
    "p256dh" TEXT,
    "deviceType" TEXT,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "platform" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "status" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "itemsSynced" INTEGER DEFAULT 0,
    "operationCount" INTEGER NOT NULL DEFAULT 0,
    "syncedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentations_mobile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT,
    "content" JSONB,
    "thumbnail" TEXT,
    "thumbnailUrl" TEXT,
    "isOfflineCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentations_mobile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_slides" (
    "id" TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_blocks" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "type" TEXT,
    "content" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_speaker_notes" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_speaker_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates_mobile" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT,
    "thumbnail" TEXT,
    "thumbnailUrl" TEXT,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "templates_mobile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_syncs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "presentationId" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "syncStatus" TEXT,

    CONSTRAINT "offline_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT,
    "title" TEXT,
    "body" TEXT,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "collaboration" BOOLEAN NOT NULL DEFAULT true,
    "comments" BOOLEAN NOT NULL DEFAULT true,
    "mentions" BOOLEAN NOT NULL DEFAULT true,
    "exports" BOOLEAN NOT NULL DEFAULT true,
    "aiGeneration" BOOLEAN NOT NULL DEFAULT true,
    "teamInvites" BOOLEAN NOT NULL DEFAULT true,
    "payments" BOOLEAN NOT NULL DEFAULT true,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_installations" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT,
    "userId" TEXT,
    "organizationId" TEXT,
    "version" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_developers" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "companyName" TEXT,
    "website" TEXT,
    "apiKey" TEXT,
    "apiKeyPrefix" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugins" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT,
    "name" TEXT,
    "description" TEXT,
    "developerId" TEXT,
    "status" TEXT,
    "version" TEXT,
    "manifest" JSONB,
    "permissions" JSONB,
    "hooks" JSONB,
    "bundleKey" TEXT,
    "bundleSize" INTEGER,
    "bundleHash" TEXT,
    "icon" TEXT,
    "category" TEXT,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_reviews" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT,
    "status" TEXT,
    "reviewerId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_versions" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT,
    "version" TEXT,
    "releaseNotes" TEXT,
    "bundleKey" TEXT,
    "manifest" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_user_reviews" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT,
    "userId" TEXT,
    "rating" INTEGER,
    "title" TEXT,
    "content" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_user_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT,
    "platform" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "profileId" TEXT,
    "profileData" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "url" TEXT,
    "shortCode" TEXT,
    "originalUrl" TEXT,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_logs" (
    "id" TEXT NOT NULL,
    "platform" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "externalPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_link_clicks" (
    "id" TEXT NOT NULL,
    "linkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_chunks" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT,
    "index" INTEGER,
    "url" TEXT,
    "type" TEXT,
    "s3Key" TEXT,
    "size" INTEGER,
    "timestamp" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "thumbnailUrl" TEXT,
    "duration" DOUBLE PRECISION,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_tracks" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "artist" TEXT,
    "duration" DOUBLE PRECISION,
    "previewUrl" TEXT,
    "mood" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_recordings" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "status" TEXT,
    "settings" JSONB,
    "duration" DOUBLE PRECISION,
    "outputUrl" TEXT,
    "outputFormat" TEXT,
    "processedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deletion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "clientOperation" JSONB,
    "serverState" JSONB,
    "resolution" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT,
    "eventData" JSONB,
    "deviceType" TEXT,
    "appVersion" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_shares" (
    "id" TEXT NOT NULL,
    "presentationId" TEXT,

    CONSTRAINT "presentation_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'dashboard',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reportData" JSONB,
    "downloadUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viewer_events" (
    "id" TEXT NOT NULL,
    "presentationId" TEXT,
    "projectId" TEXT,
    "viewerId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "slideNumber" INTEGER,
    "slideIndex" INTEGER,
    "metadata" JSONB,
    "eventData" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slide_analytics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "slideIndex" INTEGER NOT NULL,
    "slideNumber" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "avgDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgTimeSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dropOffRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interactionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slide_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_segments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_charts" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_source_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" JSONB,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_source_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_widgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presentationId" TEXT,
    "slideId" TEXT,
    "connectionId" TEXT,
    "chartId" TEXT,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "refreshEnabled" BOOLEAN NOT NULL DEFAULT false,
    "refreshInterval" INTEGER,
    "lastRefreshed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "reportData" JSONB NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabledFrameworks" JSONB NOT NULL DEFAULT '[]',
    "autoReportGeneration" BOOLEAN NOT NULL DEFAULT false,
    "reportFrequency" TEXT NOT NULL DEFAULT 'monthly',
    "notificationEmails" JSONB NOT NULL DEFAULT '[]',
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "requireMFA" BOOLEAN NOT NULL DEFAULT false,
    "enforcePasswordPolicy" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_residency_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "primaryRegion" TEXT NOT NULL,
    "allowedRegions" JSONB NOT NULL DEFAULT '[]',
    "dataReplication" BOOLEAN NOT NULL DEFAULT false,
    "replicationRegions" JSONB NOT NULL DEFAULT '[]',
    "enforceGeoRestriction" BOOLEAN NOT NULL DEFAULT false,
    "gdprCompliant" BOOLEAN NOT NULL DEFAULT false,
    "hipaaCompliant" BOOLEAN NOT NULL DEFAULT false,
    "socCompliant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_residency_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_locations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_migrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetRegion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "migrateProjects" BOOLEAN NOT NULL DEFAULT true,
    "migrateAssets" BOOLEAN NOT NULL DEFAULT true,
    "migrateBackups" BOOLEAN NOT NULL DEFAULT true,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gdpr_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "exportKey" TEXT,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gdpr_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microsoft_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "profileId" TEXT,
    "profileData" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microsoft_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "powerpoint_import_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "options" JSONB,
    "projectId" TEXT,
    "slideCount" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "powerpoint_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "s3Key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "commentNotifications" BOOLEAN NOT NULL DEFAULT true,
    "viewNotifications" BOOLEAN NOT NULL DEFAULT true,
    "shareNotifications" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_deviceId_key" ON "user_devices"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_userId_deviceId_key" ON "mobile_devices"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_isActive_idx" ON "push_subscriptions"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_userId_endpoint_key" ON "push_subscriptions"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "sync_sessions_userId_idx" ON "sync_sessions"("userId");

-- CreateIndex
CREATE INDEX "presentations_mobile_userId_idx" ON "presentations_mobile"("userId");

-- CreateIndex
CREATE INDEX "presentation_slides_presentationId_idx" ON "presentation_slides"("presentationId");

-- CreateIndex
CREATE INDEX "presentation_blocks_slideId_idx" ON "presentation_blocks"("slideId");

-- CreateIndex
CREATE INDEX "mobile_speaker_notes_slideId_idx" ON "mobile_speaker_notes"("slideId");

-- CreateIndex
CREATE INDEX "templates_mobile_userId_idx" ON "templates_mobile"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "plugin_installations_pluginId_idx" ON "plugin_installations"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_installations_userId_idx" ON "plugin_installations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "plugins_pluginId_key" ON "plugins"("pluginId");

-- CreateIndex
CREATE INDEX "plugins_developerId_idx" ON "plugins"("developerId");

-- CreateIndex
CREATE INDEX "plugins_category_idx" ON "plugins"("category");

-- CreateIndex
CREATE INDEX "plugins_status_idx" ON "plugins"("status");

-- CreateIndex
CREATE INDEX "plugin_reviews_pluginId_idx" ON "plugin_reviews"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_versions_pluginId_idx" ON "plugin_versions"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_user_reviews_pluginId_idx" ON "plugin_user_reviews"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_user_reviews_userId_idx" ON "plugin_user_reviews"("userId");

-- CreateIndex
CREATE INDEX "social_connections_userId_idx" ON "social_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "social_connections_userId_platform_key" ON "social_connections"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_shortCode_key" ON "share_links"("shortCode");

-- CreateIndex
CREATE INDEX "share_links_projectId_idx" ON "share_links"("projectId");

-- CreateIndex
CREATE INDEX "share_logs_projectId_idx" ON "share_logs"("projectId");

-- CreateIndex
CREATE INDEX "share_logs_userId_idx" ON "share_logs"("userId");

-- CreateIndex
CREATE INDEX "share_link_clicks_linkId_idx" ON "share_link_clicks"("linkId");

-- CreateIndex
CREATE INDEX "video_chunks_recordingId_idx" ON "video_chunks"("recordingId");

-- CreateIndex
CREATE INDEX "video_recordings_userId_idx" ON "video_recordings"("userId");

-- CreateIndex
CREATE INDEX "video_recordings_projectId_idx" ON "video_recordings"("projectId");

-- CreateIndex
CREATE INDEX "deletion_logs_userId_idx" ON "deletion_logs"("userId");

-- CreateIndex
CREATE INDEX "deletion_logs_deletedAt_idx" ON "deletion_logs"("deletedAt");

-- CreateIndex
CREATE INDEX "sync_conflicts_userId_resolved_idx" ON "sync_conflicts"("userId", "resolved");

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "analytics_events"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE INDEX "analytics_reports_userId_idx" ON "analytics_reports"("userId");

-- CreateIndex
CREATE INDEX "analytics_reports_status_idx" ON "analytics_reports"("status");

-- CreateIndex
CREATE INDEX "viewer_events_projectId_idx" ON "viewer_events"("projectId");

-- CreateIndex
CREATE INDEX "viewer_events_presentationId_idx" ON "viewer_events"("presentationId");

-- CreateIndex
CREATE INDEX "viewer_events_timestamp_idx" ON "viewer_events"("timestamp");

-- CreateIndex
CREATE INDEX "slide_analytics_projectId_idx" ON "slide_analytics"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "slide_analytics_projectId_slideId_key" ON "slide_analytics"("projectId", "slideId");

-- CreateIndex
CREATE INDEX "audience_segments_userId_idx" ON "audience_segments"("userId");

-- CreateIndex
CREATE INDEX "saved_charts_connectionId_idx" ON "saved_charts"("connectionId");

-- CreateIndex
CREATE INDEX "data_source_connections_userId_idx" ON "data_source_connections"("userId");

-- CreateIndex
CREATE INDEX "data_widgets_userId_idx" ON "data_widgets"("userId");

-- CreateIndex
CREATE INDEX "data_widgets_presentationId_idx" ON "data_widgets"("presentationId");

-- CreateIndex
CREATE INDEX "compliance_reports_organizationId_idx" ON "compliance_reports"("organizationId");

-- CreateIndex
CREATE INDEX "compliance_reports_framework_idx" ON "compliance_reports"("framework");

-- CreateIndex
CREATE INDEX "compliance_reports_generatedAt_idx" ON "compliance_reports"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_settings_organizationId_key" ON "compliance_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "data_residency_policies_organizationId_key" ON "data_residency_policies"("organizationId");

-- CreateIndex
CREATE INDEX "data_locations_organizationId_idx" ON "data_locations"("organizationId");

-- CreateIndex
CREATE INDEX "data_locations_region_idx" ON "data_locations"("region");

-- CreateIndex
CREATE INDEX "data_migrations_organizationId_idx" ON "data_migrations"("organizationId");

-- CreateIndex
CREATE INDEX "data_migrations_status_idx" ON "data_migrations"("status");

-- CreateIndex
CREATE INDEX "gdpr_requests_userId_idx" ON "gdpr_requests"("userId");

-- CreateIndex
CREATE INDEX "gdpr_requests_organizationId_idx" ON "gdpr_requests"("organizationId");

-- CreateIndex
CREATE INDEX "gdpr_requests_status_idx" ON "gdpr_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "microsoft_connections_userId_key" ON "microsoft_connections"("userId");

-- CreateIndex
CREATE INDEX "powerpoint_import_jobs_userId_idx" ON "powerpoint_import_jobs"("userId");

-- CreateIndex
CREATE INDEX "powerpoint_import_jobs_status_idx" ON "powerpoint_import_jobs"("status");

-- CreateIndex
CREATE INDEX "export_logs_userId_idx" ON "export_logs"("userId");

-- CreateIndex
CREATE INDEX "export_logs_projectId_idx" ON "export_logs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_userId_key" ON "notification_settings"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "presentation_views_viewedAt_idx" ON "presentation_views"("viewedAt");

-- CreateIndex
CREATE INDEX "video_export_jobs_userId_idx" ON "video_export_jobs"("userId");

-- AddForeignKey
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_views" ADD CONSTRAINT "presentation_views_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_slides" ADD CONSTRAINT "presentation_slides_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "presentations_mobile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_blocks" ADD CONSTRAINT "presentation_blocks_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "presentation_slides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_speaker_notes" ADD CONSTRAINT "mobile_speaker_notes_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "presentation_slides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_installations" ADD CONSTRAINT "plugin_installations_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "plugin_developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_reviews" ADD CONSTRAINT "plugin_reviews_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_user_reviews" ADD CONSTRAINT "plugin_user_reviews_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_link_clicks" ADD CONSTRAINT "share_link_clicks_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_chunks" ADD CONSTRAINT "video_chunks_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "video_recordings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_recordings" ADD CONSTRAINT "video_recordings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slide_analytics" ADD CONSTRAINT "slide_analytics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
