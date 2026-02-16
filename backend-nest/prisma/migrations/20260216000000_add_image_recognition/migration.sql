-- Migration: Add Image Recognition and Usage Tracking
-- Purpose: Track stock images, usage in presentations, and embeddings for similarity matching

-- Upload model for tracking downloaded/acquired images
CREATE TABLE IF NOT EXISTS "uploads" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "slideId" TEXT,
  "source" TEXT NOT NULL, -- 'ai', 'unsplash', 'pexels', 'pixabay', 'url', 'local'
  "sourceId" TEXT, -- Original ID from stock photo provider
  "url" TEXT NOT NULL,
  "localPath" TEXT,
  "thumbnailUrl" TEXT,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL DEFAULT 0,
  "width" INTEGER,
  "height" INTEGER,
  "description" TEXT,
  "tags" TEXT[], -- Array of tags for searchability
  "author" TEXT,
  "authorUrl" TEXT,
  "license" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "uploads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL,
  CONSTRAINT "uploads_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "slides"("id") ON DELETE SET NULL
);

-- Indexes for uploads
CREATE INDEX IF NOT EXISTS "uploads_userId_idx" ON "uploads"("userId");
CREATE INDEX IF NOT EXISTS "uploads_projectId_idx" ON "uploads"("projectId");
CREATE INDEX IF NOT EXISTS "uploads_slideId_idx" ON "uploads"("slideId");
CREATE INDEX IF NOT EXISTS "uploads_source_idx" ON "uploads"("source");
CREATE INDEX IF NOT EXISTS "uploads_sourceId_idx" ON "uploads"("sourceId");
CREATE INDEX IF NOT EXISTS "uploads_createdAt_idx" ON "uploads"("createdAt");
CREATE INDEX IF NOT EXISTS "uploads_tags_idx" ON "uploads" USING GIN("tags");

-- Image embeddings for similarity matching
CREATE TABLE IF NOT EXISTS "image_embeddings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "uploadId" TEXT NOT NULL UNIQUE,
  "embedding" REAL[] NOT NULL, -- Array of floats for vector embedding
  "embeddingModel" TEXT NOT NULL DEFAULT 'openai-clip', -- Model used to generate embedding
  "dimension" INTEGER NOT NULL DEFAULT 512,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "image_embeddings_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "image_embeddings_uploadId_idx" ON "image_embeddings"("uploadId");

-- Image usage tracking (many-to-many relationship)
CREATE TABLE IF NOT EXISTS "image_usage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "uploadId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "slideId" TEXT,
  "blockId" TEXT,
  "position" INTEGER, -- Position within the slide/block
  "usageType" TEXT NOT NULL DEFAULT 'content', -- 'content', 'background', 'thumbnail'
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  
  CONSTRAINT "image_usage_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE,
  CONSTRAINT "image_usage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "image_usage_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "slides"("id") ON DELETE SET NULL,
  CONSTRAINT "image_usage_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "image_usage_uploadId_idx" ON "image_usage"("uploadId");
CREATE INDEX IF NOT EXISTS "image_usage_projectId_idx" ON "image_usage"("projectId");
CREATE INDEX IF NOT EXISTS "image_usage_slideId_idx" ON "image_usage"("slideId");
CREATE INDEX IF NOT EXISTS "image_usage_blockId_idx" ON "image_usage"("blockId");
CREATE INDEX IF NOT EXISTS "image_usage_addedAt_idx" ON "image_usage"("addedAt");
CREATE INDEX IF NOT EXISTS "image_usage_active_idx" ON "image_usage"("uploadId", "projectId") WHERE "removedAt" IS NULL;

-- Image similarity cache for performance
CREATE TABLE IF NOT EXISTS "image_similarity_cache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceUploadId" TEXT NOT NULL,
  "targetUploadId" TEXT NOT NULL,
  "similarityScore" REAL NOT NULL, -- Cosine similarity score (0-1)
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "image_similarity_cache_sourceUploadId_fkey" FOREIGN KEY ("sourceUploadId") REFERENCES "uploads"("id") ON DELETE CASCADE,
  CONSTRAINT "image_similarity_cache_targetUploadId_fkey" FOREIGN KEY ("targetUploadId") REFERENCES "uploads"("id") ON DELETE CASCADE,
  UNIQUE("sourceUploadId", "targetUploadId")
);

CREATE INDEX IF NOT EXISTS "image_similarity_cache_sourceUploadId_idx" ON "image_similarity_cache"("sourceUploadId");
CREATE INDEX IF NOT EXISTS "image_similarity_cache_targetUploadId_idx" ON "image_similarity_cache"("targetUploadId");
CREATE INDEX IF NOT EXISTS "image_similarity_cache_score_idx" ON "image_similarity_cache"("similarityScore" DESC);

-- Presentation image patterns (for ML prediction)
CREATE TABLE IF NOT EXISTS "presentation_image_patterns" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "presentationType" TEXT, -- 'business', 'creative', 'educational', etc.
  "industryTags" TEXT[],
  "preferredSources" TEXT[],
  "avgImagesPerSlide" REAL,
  "commonImageTags" TEXT[],
  "colorPreferences" JSONB DEFAULT '{}',
  "stylePreferences" JSONB DEFAULT '{}',
  "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "presentation_image_patterns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  UNIQUE("userId")
);

CREATE INDEX IF NOT EXISTS "presentation_image_patterns_userId_idx" ON "presentation_image_patterns"("userId");
CREATE INDEX IF NOT EXISTS "presentation_image_patterns_industryTags_idx" ON "presentation_image_patterns" USING GIN("industryTags");
