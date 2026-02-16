-- AlterTable
ALTER TABLE "design_systems" ADD COLUMN     "colorTokens" JSONB;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "plan" TEXT DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "presentation_views" ADD COLUMN     "viewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "slides" ADD COLUMN     "content" JSONB,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" TEXT DEFAULT 'USER',
ADD COLUMN     "subscriptionStatus" TEXT DEFAULT 'ACTIVE',
ADD COLUMN     "subscriptionTier" TEXT DEFAULT 'FREE';

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "accounts_provider_idx" ON "accounts"("provider");

-- CreateIndex
CREATE INDEX "ai_generations_userId_createdAt_idx" ON "ai_generations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_generations_createdAt_idx" ON "ai_generations"("createdAt");

-- CreateIndex
CREATE INDEX "ai_generations_model_idx" ON "ai_generations"("model");

-- CreateIndex
CREATE INDEX "assets_createdAt_idx" ON "assets"("createdAt");

-- CreateIndex
CREATE INDEX "assets_mimeType_idx" ON "assets"("mimeType");

-- CreateIndex
CREATE INDEX "collaboration_sessions_isActive_idx" ON "collaboration_sessions"("isActive");

-- CreateIndex
CREATE INDEX "collaboration_sessions_startedAt_idx" ON "collaboration_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");

-- CreateIndex
CREATE INDEX "comments_resolved_idx" ON "comments"("resolved");

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "projects_ownerId_createdAt_idx" ON "projects"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_themeId_idx" ON "projects"("themeId");

-- CreateIndex
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE INDEX "slides_projectId_order_idx" ON "slides"("projectId", "order");

-- CreateIndex
CREATE INDEX "slides_createdAt_idx" ON "slides"("createdAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_subscriptionTier_idx" ON "users"("subscriptionTier");

-- CreateIndex
CREATE INDEX "users_subscriptionStatus_idx" ON "users"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");
