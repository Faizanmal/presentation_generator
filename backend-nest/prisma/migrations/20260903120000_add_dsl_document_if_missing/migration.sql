-- The previous migration (20260805180000_apply_pending_sql) was marked
-- applied on Render without executing its SQL, so production never got
-- this column. IF NOT EXISTS keeps this safe for databases that already have it.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "dslDocument" JSONB;
