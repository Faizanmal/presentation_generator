-- CreateTable
CREATE TABLE "presentation_3d" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scene" JSONB NOT NULL,
    "slides" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_3d_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presentation_3d_projectId_idx" ON "presentation_3d"("projectId");

-- AddForeignKey
ALTER TABLE "presentation_3d" ADD CONSTRAINT "presentation_3d_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
