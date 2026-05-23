-- Add data residency tracking column for Quebec sovereignty audit trail
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dataRegion" TEXT NOT NULL DEFAULT 'ca-central-1';
