-- Migration: Phase 2 Enhancements
-- Enhanced Token Tracking, Refined Agent Statuses, Ticket History

-- Add new columns to Activity table
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "contentParts" JSONB;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "cacheHits" INTEGER DEFAULT 0;

-- Add new columns to Agent table
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "statusHistory" JSONB DEFAULT '[]';
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "currentStatusSince" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "config" JSONB DEFAULT '{}';

-- Add token tracking columns to Ticket table
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "totalInputTokens" INTEGER DEFAULT 0;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "totalOutputTokens" INTEGER DEFAULT 0;

-- Create TicketHistory table
CREATE TABLE IF NOT EXISTS "TicketHistory" (
    "id" TEXT PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fromValue" JSONB,
    "toValue" JSONB,
    "changedBy" TEXT NOT NULL,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TicketHistory_ticketId_idx" ON "TicketHistory"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketHistory_timestamp_idx" ON "TicketHistory"("timestamp");
CREATE INDEX IF NOT EXISTS "TicketHistory_changeType_idx" ON "TicketHistory"("changeType");

-- Create TicketComment table
CREATE TABLE IF NOT EXISTS "TicketComment" (
    "id" TEXT PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketComment_timestamp_idx" ON "TicketComment"("timestamp");
