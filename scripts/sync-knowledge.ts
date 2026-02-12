#!/usr/bin/env node
/**
 * Sync Knowledge Files to Database
 * 
 * This script reads all markdown files from the workspace and syncs them
to the database for production use on Vercel.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

const WORKSPACE_PATH = '/home/ubuntu/.openclaw/workspace';

const KNOWLEDGE_FILES = [
  'SOUL.md', 'USER.md', 'AGENTS.md', 'MEMORY.md',
  'TOOLS.md', 'IDENTITY.md', 'BOOTSTRAP.md', 'HEARTBEAT.md',
];

function formatWorkspaceName(name) {
  if (name === 'root') return 'Root Workspace';
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

async function syncFilesystemToDatabase() {
  console.log('🔄 Syncing knowledge files to database...\n');
  
  let syncedCount = 0;
  const workspaces = ['root', 'personal', 'business', 'memory', 'skills'];

  for (const workspaceId of workspaces) {
    const dirPath = workspaceId === 'root' ? WORKSPACE_PATH : path.join(WORKSPACE_PATH, workspaceId);
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const mdFiles = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
        .map(entry => entry.name);

      console.log(`📁 ${workspaceId}: Found ${mdFiles.length} markdown files`);

      for (const filename of mdFiles) {
        const filePath = path.join(dirPath, filename);
        try {
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          const isSystemFile = KNOWLEDGE_FILES.includes(filename);

          await prisma.knowledgeFile.upsert({
            where: {
              workspaceId_name: {
                workspaceId,
                name: filename,
              },
            },
            update: {
              content,
              size: stats.size,
              lastModified: stats.mtime,
            },
            create: {
              name: filename,
              workspaceId,
              workspaceName: formatWorkspaceName(workspaceId),
              path: filePath,
              content,
              size: stats.size,
              isSystemFile,
              lastModified: stats.mtime,
            },
          });
          syncedCount++;
          console.log(`  ✓ ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
        } catch (fileError) {
          console.error(`  ✗ Error syncing ${filename}:`, fileError.message);
        }
      }
    } catch (dirError) {
      console.log(`  - Directory not found or empty`);
    }
  }

  console.log(`\n✅ Synced ${syncedCount} files to database`);
}

async function main() {
  try {
    await syncFilesystemToDatabase();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
