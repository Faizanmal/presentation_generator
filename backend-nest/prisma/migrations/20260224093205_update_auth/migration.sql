/*
  Warnings:

  - Made the column `colorPreferences` on table `presentation_image_patterns` required. This step will fail if there are existing NULL values in that column.
  - Made the column `stylePreferences` on table `presentation_image_patterns` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `uploads` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "image_embeddings" DROP CONSTRAINT "image_embeddings_uploadId_fkey";

-- DropForeignKey
ALTER TABLE "image_similarity_cache" DROP CONSTRAINT "image_similarity_cache_sourceUploadId_fkey";

-- DropForeignKey
ALTER TABLE "image_similarity_cache" DROP CONSTRAINT "image_similarity_cache_targetUploadId_fkey";

-- DropForeignKey
ALTER TABLE "image_usage" DROP CONSTRAINT "image_usage_blockId_fkey";

-- DropForeignKey
ALTER TABLE "image_usage" DROP CONSTRAINT "image_usage_projectId_fkey";

-- DropForeignKey
ALTER TABLE "image_usage" DROP CONSTRAINT "image_usage_slideId_fkey";

-- DropForeignKey
ALTER TABLE "image_usage" DROP CONSTRAINT "image_usage_uploadId_fkey";

-- DropForeignKey
ALTER TABLE "presentation_image_patterns" DROP CONSTRAINT "presentation_image_patterns_userId_fkey";

-- DropForeignKey
ALTER TABLE "uploads" DROP CONSTRAINT "uploads_projectId_fkey";

-- DropForeignKey
ALTER TABLE "uploads" DROP CONSTRAINT "uploads_slideId_fkey";

-- DropForeignKey
ALTER TABLE "uploads" DROP CONSTRAINT "uploads_userId_fkey";

-- DropIndex
DROP INDEX "image_similarity_cache_score_idx";

-- DropIndex
DROP INDEX "image_usage_active_idx";

-- DropIndex
DROP INDEX "presentation_image_patterns_industryTags_idx";

-- DropIndex
DROP INDEX "uploads_tags_idx";

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "image_embeddings" ALTER COLUMN "embedding" SET DATA TYPE DOUBLE PRECISION[],
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "image_similarity_cache" ALTER COLUMN "similarityScore" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "presentation_image_patterns" ALTER COLUMN "industryTags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "preferredSources" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "avgImagesPerSlide" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "commonImageTags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "colorPreferences" SET NOT NULL,
ALTER COLUMN "stylePreferences" SET NOT NULL;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "analytics" JSONB;

-- AlterTable
ALTER TABLE "slides" ADD COLUMN     "speakerNotes" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "transition" TEXT DEFAULT 'fade';

-- AlterTable
ALTER TABLE "uploads" ADD COLUMN     "originalName" TEXT,
ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "settings" JSONB;

-- CreateTable
CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "colorPalette" JSONB,
    "headingFont" TEXT,
    "bodyFont" TEXT,
    "fontSizes" JSONB,
    "logoUrl" TEXT,
    "logoLight" TEXT,
    "logoDark" TEXT,
    "favicon" TEXT,
    "coverImages" JSONB,
    "icons" JSONB,
    "patterns" JSONB,
    "watermark" TEXT,
    "watermarkOpacity" DOUBLE PRECISION DEFAULT 0.3,
    "voiceDescription" TEXT,
    "toneKeywords" JSONB,
    "doList" JSONB,
    "dontList" JSONB,
    "styleGuideUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_research" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "topic" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "results" JSONB,
    "summary" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "content_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_research_sources" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "snippet" TEXT,
    "relevanceScore" DOUBLE PRECISION,
    "credibilityScore" DOUBLE PRECISION,
    "publishedDate" TIMESTAMP(3),
    "author" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_research_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyboards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL,
    "presentationType" TEXT NOT NULL,
    "duration" INTEGER,
    "narrativeArc" JSONB NOT NULL,
    "pacing" JSONB,
    "transitions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storyboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyboard_sections" (
    "id" TEXT NOT NULL,
    "storyboardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "duration" INTEGER,
    "keyPoints" JSONB NOT NULL,
    "suggestedLayout" TEXT,
    "speakerNotes" TEXT,
    "transitionIn" TEXT,
    "transitionOut" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storyboard_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "goalMetric" TEXT NOT NULL DEFAULT 'engagement',
    "winnerVariantId" TEXT,
    "sampleSize" INTEGER NOT NULL DEFAULT 100,
    "currentSample" INTEGER NOT NULL DEFAULT 0,
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_variants" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "themeConfig" JSONB NOT NULL,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "traffic" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgViewTime" DOUBLE PRECISION,
    "bounceRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_results" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "viewerId" TEXT,
    "engaged" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "viewTime" INTEGER,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "dropOffSlide" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vr_exports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'webxr',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "config" JSONB NOT NULL,
    "outputUrl" TEXT,
    "previewUrl" TEXT,
    "optimizedFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileSize" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "vr_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vr_scenes" (
    "id" TEXT NOT NULL,
    "vrExportId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'default',
    "background360" TEXT,
    "objects3d" JSONB,
    "transitions" JSONB,
    "hotspots" JSONB,
    "spatialAudio" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vr_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_overlays" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slideId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "markerUrl" TEXT,
    "content3d" JSONB NOT NULL,
    "animations" JSONB,
    "interactions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ar_overlays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holographic_previews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "displayType" TEXT NOT NULL DEFAULT 'looking_glass',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "config" JSONB NOT NULL,
    "quilts" JSONB,
    "outputUrl" TEXT,
    "previewUrl" TEXT,
    "depth" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "viewAngle" DOUBLE PRECISION NOT NULL DEFAULT 45,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "holographic_previews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT,
    "contractAddress" TEXT,
    "chainId" TEXT NOT NULL DEFAULT 'ethereum',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "mintPrice" DOUBLE PRECISION,
    "royaltyPercent" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "maxSupply" INTEGER,
    "mintedCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_mints" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "templateId" TEXT,
    "tokenId" TEXT,
    "transactionHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "price" DOUBLE PRECISION,
    "chainId" TEXT NOT NULL DEFAULT 'ethereum',
    "ownerAddress" TEXT,
    "metadata" JSONB NOT NULL,
    "ipfsHash" TEXT,
    "error" TEXT,
    "mintedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nft_mints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_ownership" (
    "id" TEXT NOT NULL,
    "nftId" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" DOUBLE PRECISION,
    "transactionHash" TEXT,
    "previousOwner" TEXT,
    "isCurrentOwner" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "nft_ownership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_royalties" (
    "id" TEXT NOT NULL,
    "nftId" TEXT NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionHash" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nft_royalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "slideId" TEXT,
    "title" TEXT,
    "context" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_qa_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderationLevel" TEXT NOT NULL DEFAULT 'medium',
    "anonymousAllowed" BOOLEAN NOT NULL DEFAULT true,
    "maxQuestions" INTEGER,
    "aiSummary" TEXT,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_qa_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_questions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousName" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "hostId" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderationScore" DOUBLE PRECISION,
    "moderationReason" TEXT,
    "aiAnalysis" JSONB,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "answer" TEXT,
    "answeredBy" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_transforms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" JSONB NOT NULL,
    "path" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "version" INTEGER NOT NULL,
    "vectorClock" JSONB NOT NULL,
    "serverSeq" INTEGER NOT NULL,
    "clientSeq" INTEGER NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "conflictWith" TEXT,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_transforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_syncs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT NOT NULL,
    "platform" TEXT,
    "appVersion" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "syncState" JSONB,
    "offlineData" JSONB,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictive_insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "insightType" TEXT,
    "prediction" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "recommendations" JSONB NOT NULL,
    "mlModelVersion" TEXT,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "isActioned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "predictive_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_predictions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slideId" TEXT,
    "predictedScore" DOUBLE PRECISION NOT NULL,
    "predictedEngagement" DOUBLE PRECISION,
    "predictedCompletion" DOUBLE PRECISION,
    "predictedShares" DOUBLE PRECISION,
    "actualScore" DOUBLE PRECISION,
    "modelVersion" TEXT,
    "factors" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measuredAt" TIMESTAMP(3),

    CONSTRAINT "engagement_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "presenterId" TEXT NOT NULL,
    "hostId" TEXT,
    "slideId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "webcamEnabled" BOOLEAN NOT NULL DEFAULT false,
    "feedbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "overallSentiment" JSONB,
    "heatmapData" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_snapshots" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "slideIndex" INTEGER NOT NULL,
    "slideId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentiment" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "faceCount" INTEGER NOT NULL DEFAULT 0,
    "participantCount" INTEGER,
    "emotions" JSONB,
    "feedbackData" JSONB,
    "metrics" JSONB,

    CONSTRAINT "sentiment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedTime" INTEGER,
    "difficulty" TEXT NOT NULL DEFAULT 'beginner',
    "category" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_modules" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "slideId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'lesson',
    "estimatedMinutes" INTEGER,
    "resources" JSONB,
    "quizConfig" JSONB,
    "completionCriteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quizScore" DOUBLE PRECISION,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_language_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'ASL',
    "avatarStyle" TEXT NOT NULL DEFAULT 'realistic',
    "avatarPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "avatarSize" TEXT NOT NULL DEFAULT 'medium',
    "speed" TEXT NOT NULL DEFAULT 'normal',
    "backgroundColor" TEXT,
    "transparency" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sign_language_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_language_translations" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "blockId" TEXT,
    "sourceText" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ASL',
    "signSequence" JSONB NOT NULL,
    "glossSequence" JSONB,
    "videoUrl" TEXT,
    "duration" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_language_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cognitive_accessibility_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dyslexiaMode" BOOLEAN NOT NULL DEFAULT false,
    "dyslexiaFont" TEXT NOT NULL DEFAULT 'OpenDyslexic',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "simplifiedLayout" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "largerText" BOOLEAN NOT NULL DEFAULT false,
    "textSpacing" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "focusHighlight" BOOLEAN NOT NULL DEFAULT true,
    "voiceNavigation" BOOLEAN NOT NULL DEFAULT false,
    "readingGuide" BOOLEAN NOT NULL DEFAULT false,
    "colorOverlay" TEXT,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cognitive_accessibility_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universal_design_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "accessibilityScore" DOUBLE PRECISION NOT NULL,
    "culturalScore" DOUBLE PRECISION NOT NULL,
    "readabilityScore" DOUBLE PRECISION NOT NULL,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB NOT NULL,
    "details" JSONB,
    "suggestions" JSONB NOT NULL,
    "targetRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universal_design_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cultural_issues" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "slideId" TEXT,
    "blockId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestion" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cultural_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "rateLimits" JSONB,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latency" INTEGER NOT NULL,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdk_configurations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sdkKey" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isHeadless" BOOLEAN NOT NULL DEFAULT false,
    "branding" JSONB,
    "customBranding" JSONB,
    "customDomain" TEXT,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "features" JSONB NOT NULL,
    "theme" JSONB,
    "apiEndpoint" TEXT,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sdk_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdk_instances" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "instanceKey" TEXT NOT NULL,
    "clientName" TEXT,
    "domain" TEXT NOT NULL,
    "customBranding" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "usageStats" JSONB,
    "lastActiveAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sdk_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceToken" TEXT,
    "name" TEXT NOT NULL,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastConnectedAt" TIMESTAMP(3),
    "lastPing" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_commands" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "projectId" TEXT,
    "command" TEXT NOT NULL,
    "payload" JSONB,
    "parameters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iot_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ecoScore" DOUBLE PRECISION NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "compressedSize" INTEGER,
    "estimatedEnergy" DOUBLE PRECISION,
    "animationCount" INTEGER NOT NULL DEFAULT 0,
    "heavyMediaCount" INTEGER NOT NULL DEFAULT 0,
    "optimizations" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "period" TEXT,
    "generatedAt" TIMESTAMP(3),
    "totalEmissions" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eco_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carbon_footprints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dataTransferKb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "deviceViews" JSONB,
    "regionViews" JSONB,
    "estimatedCO2g" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carbon_footprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wellness_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "webcamEnabled" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "wellnessScore" DOUBLE PRECISION,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "breaksTaken" INTEGER NOT NULL DEFAULT 0,
    "hydrationReminders" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "recommendations" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "presentation" JSONB,

    CONSTRAINT "wellness_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wellness_metrics" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "raw" JSONB,
    "alert" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "wellness_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carbon_offsets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "certificateUrl" TEXT,
    "transactionId" TEXT,
    "emissionsKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carbon_offsets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_kits_organizationId_idx" ON "brand_kits"("organizationId");

-- CreateIndex
CREATE INDEX "brand_kits_userId_idx" ON "brand_kits"("userId");

-- CreateIndex
CREATE INDEX "content_research_userId_idx" ON "content_research"("userId");

-- CreateIndex
CREATE INDEX "content_research_projectId_idx" ON "content_research"("projectId");

-- CreateIndex
CREATE INDEX "content_research_status_idx" ON "content_research"("status");

-- CreateIndex
CREATE INDEX "content_research_sources_researchId_idx" ON "content_research_sources"("researchId");

-- CreateIndex
CREATE INDEX "content_research_sources_sourceType_idx" ON "content_research_sources"("sourceType");

-- CreateIndex
CREATE INDEX "storyboards_userId_idx" ON "storyboards"("userId");

-- CreateIndex
CREATE INDEX "storyboards_projectId_idx" ON "storyboards"("projectId");

-- CreateIndex
CREATE INDEX "storyboard_sections_storyboardId_idx" ON "storyboard_sections"("storyboardId");

-- CreateIndex
CREATE INDEX "ab_tests_userId_idx" ON "ab_tests"("userId");

-- CreateIndex
CREATE INDEX "ab_tests_projectId_idx" ON "ab_tests"("projectId");

-- CreateIndex
CREATE INDEX "ab_tests_status_idx" ON "ab_tests"("status");

-- CreateIndex
CREATE INDEX "ab_test_variants_testId_idx" ON "ab_test_variants"("testId");

-- CreateIndex
CREATE INDEX "ab_test_results_testId_idx" ON "ab_test_results"("testId");

-- CreateIndex
CREATE INDEX "ab_test_results_variantId_idx" ON "ab_test_results"("variantId");

-- CreateIndex
CREATE INDEX "ab_test_results_sessionId_idx" ON "ab_test_results"("sessionId");

-- CreateIndex
CREATE INDEX "vr_exports_userId_idx" ON "vr_exports"("userId");

-- CreateIndex
CREATE INDEX "vr_exports_projectId_idx" ON "vr_exports"("projectId");

-- CreateIndex
CREATE INDEX "vr_exports_status_idx" ON "vr_exports"("status");

-- CreateIndex
CREATE INDEX "vr_scenes_vrExportId_idx" ON "vr_scenes"("vrExportId");

-- CreateIndex
CREATE INDEX "ar_overlays_userId_idx" ON "ar_overlays"("userId");

-- CreateIndex
CREATE INDEX "ar_overlays_projectId_idx" ON "ar_overlays"("projectId");

-- CreateIndex
CREATE INDEX "holographic_previews_userId_idx" ON "holographic_previews"("userId");

-- CreateIndex
CREATE INDEX "holographic_previews_projectId_idx" ON "holographic_previews"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "nft_collections_contractAddress_key" ON "nft_collections"("contractAddress");

-- CreateIndex
CREATE INDEX "nft_collections_userId_idx" ON "nft_collections"("userId");

-- CreateIndex
CREATE INDEX "nft_collections_contractAddress_idx" ON "nft_collections"("contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "nft_mints_tokenId_key" ON "nft_mints"("tokenId");

-- CreateIndex
CREATE INDEX "nft_mints_collectionId_idx" ON "nft_mints"("collectionId");

-- CreateIndex
CREATE INDEX "nft_mints_userId_idx" ON "nft_mints"("userId");

-- CreateIndex
CREATE INDEX "nft_mints_projectId_idx" ON "nft_mints"("projectId");

-- CreateIndex
CREATE INDEX "nft_mints_tokenId_idx" ON "nft_mints"("tokenId");

-- CreateIndex
CREATE INDEX "nft_ownership_nftId_idx" ON "nft_ownership"("nftId");

-- CreateIndex
CREATE INDEX "nft_ownership_ownerAddress_idx" ON "nft_ownership"("ownerAddress");

-- CreateIndex
CREATE INDEX "nft_royalties_nftId_idx" ON "nft_royalties"("nftId");

-- CreateIndex
CREATE INDEX "nft_royalties_creatorAddress_idx" ON "nft_royalties"("creatorAddress");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_userId_idx" ON "ai_chat_sessions"("userId");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_projectId_idx" ON "ai_chat_sessions"("projectId");

-- CreateIndex
CREATE INDEX "ai_chat_messages_sessionId_idx" ON "ai_chat_messages"("sessionId");

-- CreateIndex
CREATE INDEX "live_qa_sessions_projectId_idx" ON "live_qa_sessions"("projectId");

-- CreateIndex
CREATE INDEX "live_qa_sessions_hostUserId_idx" ON "live_qa_sessions"("hostUserId");

-- CreateIndex
CREATE INDEX "live_qa_sessions_status_idx" ON "live_qa_sessions"("status");

-- CreateIndex
CREATE INDEX "live_questions_sessionId_idx" ON "live_questions"("sessionId");

-- CreateIndex
CREATE INDEX "live_questions_status_idx" ON "live_questions"("status");

-- CreateIndex
CREATE INDEX "operational_transforms_projectId_idx" ON "operational_transforms"("projectId");

-- CreateIndex
CREATE INDEX "operational_transforms_userId_idx" ON "operational_transforms"("userId");

-- CreateIndex
CREATE INDEX "operational_transforms_serverSeq_idx" ON "operational_transforms"("serverSeq");

-- CreateIndex
CREATE UNIQUE INDEX "device_syncs_deviceId_key" ON "device_syncs"("deviceId");

-- CreateIndex
CREATE INDEX "device_syncs_userId_idx" ON "device_syncs"("userId");

-- CreateIndex
CREATE INDEX "device_syncs_deviceId_idx" ON "device_syncs"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "device_syncs_userId_deviceId_key" ON "device_syncs"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "predictive_insights_projectId_idx" ON "predictive_insights"("projectId");

-- CreateIndex
CREATE INDEX "predictive_insights_userId_idx" ON "predictive_insights"("userId");

-- CreateIndex
CREATE INDEX "predictive_insights_type_idx" ON "predictive_insights"("type");

-- CreateIndex
CREATE INDEX "engagement_predictions_projectId_idx" ON "engagement_predictions"("projectId");

-- CreateIndex
CREATE INDEX "engagement_predictions_slideId_idx" ON "engagement_predictions"("slideId");

-- CreateIndex
CREATE INDEX "sentiment_sessions_projectId_idx" ON "sentiment_sessions"("projectId");

-- CreateIndex
CREATE INDEX "sentiment_sessions_presenterId_idx" ON "sentiment_sessions"("presenterId");

-- CreateIndex
CREATE INDEX "sentiment_snapshots_sessionId_idx" ON "sentiment_snapshots"("sessionId");

-- CreateIndex
CREATE INDEX "sentiment_snapshots_slideIndex_idx" ON "sentiment_snapshots"("slideIndex");

-- CreateIndex
CREATE INDEX "learning_paths_userId_idx" ON "learning_paths"("userId");

-- CreateIndex
CREATE INDEX "learning_paths_projectId_idx" ON "learning_paths"("projectId");

-- CreateIndex
CREATE INDEX "learning_modules_pathId_idx" ON "learning_modules"("pathId");

-- CreateIndex
CREATE INDEX "learner_progress_userId_idx" ON "learner_progress"("userId");

-- CreateIndex
CREATE INDEX "learner_progress_pathId_idx" ON "learner_progress"("pathId");

-- CreateIndex
CREATE UNIQUE INDEX "learner_progress_userId_moduleId_key" ON "learner_progress"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "sign_language_configs_projectId_idx" ON "sign_language_configs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "sign_language_configs_projectId_key" ON "sign_language_configs"("projectId");

-- CreateIndex
CREATE INDEX "sign_language_translations_configId_idx" ON "sign_language_translations"("configId");

-- CreateIndex
CREATE INDEX "sign_language_translations_slideId_idx" ON "sign_language_translations"("slideId");

-- CreateIndex
CREATE UNIQUE INDEX "cognitive_accessibility_profiles_userId_key" ON "cognitive_accessibility_profiles"("userId");

-- CreateIndex
CREATE INDEX "cognitive_accessibility_profiles_userId_idx" ON "cognitive_accessibility_profiles"("userId");

-- CreateIndex
CREATE INDEX "universal_design_reports_projectId_idx" ON "universal_design_reports"("projectId");

-- CreateIndex
CREATE INDEX "cultural_issues_reportId_idx" ON "cultural_issues"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_organizationId_idx" ON "api_keys"("organizationId");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_usage_logs_apiKeyId_idx" ON "api_usage_logs"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_usage_logs_endpoint_idx" ON "api_usage_logs"("endpoint");

-- CreateIndex
CREATE INDEX "api_usage_logs_createdAt_idx" ON "api_usage_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sdk_configurations_organizationId_key" ON "sdk_configurations"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sdk_configurations_sdkKey_key" ON "sdk_configurations"("sdkKey");

-- CreateIndex
CREATE INDEX "sdk_configurations_organizationId_idx" ON "sdk_configurations"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sdk_instances_instanceKey_key" ON "sdk_instances"("instanceKey");

-- CreateIndex
CREATE INDEX "sdk_instances_configId_idx" ON "sdk_instances"("configId");

-- CreateIndex
CREATE INDEX "sdk_instances_instanceKey_idx" ON "sdk_instances"("instanceKey");

-- CreateIndex
CREATE UNIQUE INDEX "iot_devices_deviceId_key" ON "iot_devices"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "iot_devices_deviceToken_key" ON "iot_devices"("deviceToken");

-- CreateIndex
CREATE INDEX "iot_devices_userId_idx" ON "iot_devices"("userId");

-- CreateIndex
CREATE INDEX "iot_devices_deviceId_idx" ON "iot_devices"("deviceId");

-- CreateIndex
CREATE INDEX "iot_commands_deviceId_idx" ON "iot_commands"("deviceId");

-- CreateIndex
CREATE INDEX "iot_commands_projectId_idx" ON "iot_commands"("projectId");

-- CreateIndex
CREATE INDEX "eco_reports_projectId_idx" ON "eco_reports"("projectId");

-- CreateIndex
CREATE INDEX "eco_reports_userId_idx" ON "eco_reports"("userId");

-- CreateIndex
CREATE INDEX "carbon_footprints_userId_idx" ON "carbon_footprints"("userId");

-- CreateIndex
CREATE INDEX "carbon_footprints_projectId_idx" ON "carbon_footprints"("projectId");

-- CreateIndex
CREATE INDEX "carbon_footprints_periodStart_periodEnd_idx" ON "carbon_footprints"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "wellness_sessions_userId_idx" ON "wellness_sessions"("userId");

-- CreateIndex
CREATE INDEX "wellness_sessions_projectId_idx" ON "wellness_sessions"("projectId");

-- CreateIndex
CREATE INDEX "wellness_metrics_sessionId_idx" ON "wellness_metrics"("sessionId");

-- CreateIndex
CREATE INDEX "wellness_metrics_metricType_idx" ON "wellness_metrics"("metricType");

-- CreateIndex
CREATE INDEX "carbon_offsets_userId_idx" ON "carbon_offsets"("userId");

-- CreateIndex
CREATE INDEX "carbon_offsets_status_idx" ON "carbon_offsets"("status");

-- CreateIndex
CREATE INDEX "image_similarity_cache_similarityScore_idx" ON "image_similarity_cache"("similarityScore");

-- CreateIndex
CREATE INDEX "image_usage_uploadId_projectId_removedAt_idx" ON "image_usage"("uploadId", "projectId", "removedAt");

-- CreateIndex
CREATE INDEX "presentation_image_patterns_industryTags_idx" ON "presentation_image_patterns"("industryTags");

-- CreateIndex
CREATE INDEX "uploads_tags_idx" ON "uploads"("tags");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "slides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_embeddings" ADD CONSTRAINT "image_embeddings_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_usage" ADD CONSTRAINT "image_usage_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_usage" ADD CONSTRAINT "image_usage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_usage" ADD CONSTRAINT "image_usage_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "slides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_similarity_cache" ADD CONSTRAINT "image_similarity_cache_sourceUploadId_fkey" FOREIGN KEY ("sourceUploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_similarity_cache" ADD CONSTRAINT "image_similarity_cache_targetUploadId_fkey" FOREIGN KEY ("targetUploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_image_patterns" ADD CONSTRAINT "presentation_image_patterns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_research_sources" ADD CONSTRAINT "content_research_sources_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "content_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyboard_sections" ADD CONSTRAINT "storyboard_sections_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "storyboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ab_test_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vr_scenes" ADD CONSTRAINT "vr_scenes_vrExportId_fkey" FOREIGN KEY ("vrExportId") REFERENCES "vr_exports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_mints" ADD CONSTRAINT "nft_mints_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "nft_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_ownership" ADD CONSTRAINT "nft_ownership_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "nft_mints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_royalties" ADD CONSTRAINT "nft_royalties_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "nft_mints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_questions" ADD CONSTRAINT "live_questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_qa_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentiment_snapshots" ADD CONSTRAINT "sentiment_snapshots_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sentiment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_progress" ADD CONSTRAINT "learner_progress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_language_translations" ADD CONSTRAINT "sign_language_translations_configId_fkey" FOREIGN KEY ("configId") REFERENCES "sign_language_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultural_issues" ADD CONSTRAINT "cultural_issues_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "universal_design_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdk_instances" ADD CONSTRAINT "sdk_instances_configId_fkey" FOREIGN KEY ("configId") REFERENCES "sdk_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_commands" ADD CONSTRAINT "iot_commands_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wellness_metrics" ADD CONSTRAINT "wellness_metrics_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "wellness_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carbon_offsets" ADD CONSTRAINT "carbon_offsets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
