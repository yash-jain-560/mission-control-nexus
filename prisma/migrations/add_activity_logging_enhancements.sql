-- Migration: Add Activity Logging Enhancements
-- This migration adds comprehensive fields for activity tracking

-- Add new columns to Activity table
ALTER TABLE "Activity" 
  ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "apiEndpoint" TEXT,
  ADD COLUMN IF NOT EXISTS "apiMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "apiStatusCode" INTEGER,
  ADD COLUMN IF NOT EXISTS "parentActivityId" TEXT,
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "requestId" TEXT,
  ADD COLUMN IF NOT EXISTS "traceId" TEXT,
  ADD COLUMN IF NOT EXISTS "costInput" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "costOutput" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "costTotal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "modelName" TEXT;

-- Add self-referencing foreign key for activity chain
ALTER TABLE "Activity" 
  ADD CONSTRAINT "Activity_parentActivityId_fkey" 
  FOREIGN KEY ("parentActivityId") 
  REFERENCES "Activity"(id) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "Activity_parentActivityId_idx" ON "Activity"("parentActivityId");
CREATE INDEX IF NOT EXISTS "Activity_traceId_idx" ON "Activity"("traceId");
CREATE INDEX IF NOT EXISTS "Activity_sessionId_idx" ON "Activity"("sessionId");
CREATE INDEX IF NOT EXISTS "Activity_requestId_idx" ON "Activity"("requestId");

-- Update existing records to set totalTokens
UPDATE "Activity" 
SET "totalTokens" = "inputTokens" + "outputTokens"
WHERE "totalTokens" = 0;