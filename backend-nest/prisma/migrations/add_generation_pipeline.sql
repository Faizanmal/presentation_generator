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
