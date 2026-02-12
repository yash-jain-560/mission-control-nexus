-- CreateTable Agent
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenUsage" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable Ticket
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable Activity
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "agentId" TEXT,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agent_name_idx" ON "Agent"("name");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_lastHeartbeat_idx" ON "Agent"("lastHeartbeat");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_agentId_idx" ON "Ticket"("agentId");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_agentId_idx" ON "Activity"("agentId");

-- CreateIndex
CREATE INDEX "Activity_ticketId_idx" ON "Activity"("ticketId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
