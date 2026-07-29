-- Persist canonical AI PresentationDocument (includes editMemory) on projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dslDocument" JSONB;
