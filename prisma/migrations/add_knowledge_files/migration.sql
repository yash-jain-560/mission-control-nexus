-- Add KnowledgeFile table for database-backed knowledge base
CREATE TABLE "KnowledgeFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'root',
    "workspaceName" TEXT NOT NULL DEFAULT 'Root Workspace',
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastModified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSystemFile" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "KnowledgeFile_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "KnowledgeFile_workspaceId_idx" ON "KnowledgeFile"("workspaceId");
CREATE INDEX "KnowledgeFile_name_idx" ON "KnowledgeFile"("name");
CREATE UNIQUE INDEX "KnowledgeFile_workspaceId_name_key" ON "KnowledgeFile"("workspaceId", "name");
