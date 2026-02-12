import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const WORKSPACE_PATH = '/home/ubuntu/.openclaw/workspace';

// Key knowledge files to track
const KNOWLEDGE_FILES = [
  'SOUL.md',
  'USER.md',
  'AGENTS.md',
  'MEMORY.md',
  'TOOLS.md',
  'IDENTITY.md',
  'BOOTSTRAP.md',
  'HEARTBEAT.md',
];

interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  files: KnowledgeFileData[];
}

interface KnowledgeFileData {
  name: string;
  workspaceId: string;
  workspaceName: string;
  path: string;
  content: string;
  lastModified: string;
  size: number;
  isSystemFile: boolean;
}

// GET /api/knowledge - List all knowledge files across workspaces
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const file = searchParams.get('file');
    const workspace = searchParams.get('workspace');
    const format = searchParams.get('format') || 'tree';
    const sync = searchParams.get('sync') === 'true';

    // If sync requested and running locally, sync filesystem to database
    if (sync) {
      await syncFilesystemToDatabase();
    }

    // If file is specified, return that file's content
    if (file) {
      return getFileContent(file, workspace || undefined);
    }

    // Get files from database
    const dbFiles = await prisma.knowledgeFile.findMany({
      where: workspace ? { workspaceId: workspace } : undefined,
      orderBy: [{ workspaceId: 'asc' }, { name: 'asc' }],
    });

    // If no files in database and running locally, try to sync
    if (dbFiles.length === 0) {
      const synced = await syncFilesystemToDatabase();
      if (synced > 0) {
        // Re-fetch after sync
        const refreshedFiles = await prisma.knowledgeFile.findMany({
          where: workspace ? { workspaceId: workspace } : undefined,
          orderBy: [{ workspaceId: 'asc' }, { name: 'asc' }],
        });
        return formatResponse(refreshedFiles, format);
      }
    }

    return formatResponse(dbFiles, format);
  } catch (error) {
    console.error('Error fetching knowledge files:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge files' }, { status: 500 });
  }
}

// Format response based on requested format
function formatResponse(dbFiles: any[], format: string) {
  const files: KnowledgeFileData[] = dbFiles.map(f => ({
    name: f.name,
    workspaceId: f.workspaceId,
    workspaceName: f.workspaceName,
    path: f.path,
    content: f.content,
    lastModified: f.lastModified.toISOString(),
    size: f.size,
    isSystemFile: f.isSystemFile,
  }));

  if (format === 'flat') {
    return NextResponse.json({
      files,
      workspaces: [...new Set(files.map(f => ({ id: f.workspaceId, name: f.workspaceName })))],
      totalSize: files.reduce((acc, f) => acc + f.size, 0),
      totalFiles: files.length,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Group by workspace for tree format
  const workspaces: WorkspaceInfo[] = [];
  const workspaceMap = new Map<string, WorkspaceInfo>();

  for (const file of files) {
    if (!workspaceMap.has(file.workspaceId)) {
      const workspace: WorkspaceInfo = {
        id: file.workspaceId,
        name: file.workspaceName,
        path: file.workspaceId === 'root' ? WORKSPACE_PATH : path.join(WORKSPACE_PATH, file.workspaceId),
        files: [],
      };
      workspaceMap.set(file.workspaceId, workspace);
      workspaces.push(workspace);
    }
    workspaceMap.get(file.workspaceId)!.files.push(file);
  }

  return NextResponse.json({
    workspaces,
    totalFiles: files.length,
    totalSize: files.reduce((acc, f) => acc + f.size, 0),
    lastUpdated: new Date().toISOString(),
  });
}

// PUT /api/knowledge - Update a knowledge file
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { file, workspace, content } = body;

    if (!file || content === undefined) {
      return NextResponse.json({ error: 'Missing required fields: file, content' }, { status: 400 });
    }

    // Security: only allow .md files and prevent directory traversal
    if (!file.endsWith('.md') || file.includes('..') || file.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const workspaceId = workspace || 'root';
    const filePath = workspaceId === 'root' 
      ? path.join(WORKSPACE_PATH, file)
      : path.join(WORKSPACE_PATH, workspaceId, file);

    // Update or create in database
    const size = Buffer.byteLength(content, 'utf-8');
    const isSystemFile = KNOWLEDGE_FILES.includes(file);

    const dbFile = await prisma.knowledgeFile.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name: file,
        },
      },
      update: {
        content,
        size,
        lastModified: new Date(),
      },
      create: {
        name: file,
        workspaceId,
        workspaceName: formatWorkspaceName(workspaceId),
        path: filePath,
        content,
        size,
        isSystemFile,
      },
    });

    // Also update filesystem if running locally
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (fsError) {
      // Filesystem update failed, but database is updated - that's ok for Vercel
      console.log('Filesystem update skipped (likely Vercel environment)');
    }

    return NextResponse.json({
      name: dbFile.name,
      workspaceId: dbFile.workspaceId,
      workspaceName: dbFile.workspaceName,
      path: dbFile.path,
      content: dbFile.content,
      lastModified: dbFile.lastModified.toISOString(),
      size: dbFile.size,
      message: 'File updated successfully',
    });
  } catch (error) {
    console.error('Error updating knowledge file:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}

// POST /api/knowledge - Create a new knowledge file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file, workspace, content = '' } = body;

    if (!file) {
      return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 });
    }

    // Security: only allow .md files and prevent directory traversal
    if (!file.endsWith('.md') || file.includes('..') || file.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const workspaceId = workspace || 'root';
    const filePath = workspaceId === 'root'
      ? path.join(WORKSPACE_PATH, file)
      : path.join(WORKSPACE_PATH, workspaceId, file);

    // Check if file already exists in database
    const existing = await prisma.knowledgeFile.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: file,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'File already exists' }, { status: 409 });
    }

    const size = Buffer.byteLength(content, 'utf-8');
    const isSystemFile = KNOWLEDGE_FILES.includes(file);

    // Create in database
    const dbFile = await prisma.knowledgeFile.create({
      data: {
        name: file,
        workspaceId,
        workspaceName: formatWorkspaceName(workspaceId),
        path: filePath,
        content,
        size,
        isSystemFile,
      },
    });

    // Also create on filesystem if running locally
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (fsError) {
      // Filesystem update skipped for Vercel
      console.log('Filesystem create skipped (likely Vercel environment)');
    }

    return NextResponse.json({
      name: dbFile.name,
      workspaceId: dbFile.workspaceId,
      workspaceName: dbFile.workspaceName,
      path: dbFile.path,
      content: dbFile.content,
      lastModified: dbFile.lastModified.toISOString(),
      size: dbFile.size,
      message: 'File created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating knowledge file:', error);
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 });
  }
}

// DELETE /api/knowledge - Delete a knowledge file
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const file = searchParams.get('file');
    const workspace = searchParams.get('workspace');

    if (!file) {
      return NextResponse.json({ error: 'Missing required parameter: file' }, { status: 400 });
    }

    // Security: only allow .md files and prevent directory traversal
    if (!file.endsWith('.md') || file.includes('..') || file.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const workspaceId = workspace || 'root';
    const filePath = workspaceId === 'root'
      ? path.join(WORKSPACE_PATH, file)
      : path.join(WORKSPACE_PATH, workspaceId, file);

    // Delete from database
    await prisma.knowledgeFile.delete({
      where: {
        workspaceId_name: {
          workspaceId,
          name: file,
        },
      },
    });

    // Also delete from filesystem if running locally
    try {
      await fs.unlink(filePath);
    } catch (fsError) {
      // Filesystem delete skipped for Vercel
      console.log('Filesystem delete skipped (likely Vercel environment)');
    }

    return NextResponse.json({
      message: 'File deleted successfully',
      name: file,
      workspaceId,
    });
  } catch (error) {
    console.error('Error deleting knowledge file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

// GET helper for single file
async function getFileContent(filename: string, workspace?: string) {
  try {
    // Security: only allow .md files and prevent directory traversal
    if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const workspaceId = workspace || 'root';

    // Try to get from database first
    const dbFile = await prisma.knowledgeFile.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: filename,
        },
      },
    });

    if (dbFile) {
      return NextResponse.json({
        name: dbFile.name,
        workspaceId: dbFile.workspaceId,
        workspaceName: dbFile.workspaceName,
        path: dbFile.path,
        content: dbFile.content,
        lastModified: dbFile.lastModified.toISOString(),
        size: dbFile.size,
      });
    }

    // If not in database, try filesystem (local dev only)
    const filePath = workspaceId === 'root'
      ? path.join(WORKSPACE_PATH, filename)
      : path.join(WORKSPACE_PATH, workspaceId, filename);

    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return NextResponse.json({ error: 'Not a file' }, { status: 400 });
      }

      const content = await fs.readFile(filePath, 'utf-8');

      // Save to database for future requests
      await prisma.knowledgeFile.create({
        data: {
          name: filename,
          workspaceId,
          workspaceName: formatWorkspaceName(workspaceId),
          path: filePath,
          content,
          size: stats.size,
          isSystemFile: KNOWLEDGE_FILES.includes(filename),
          lastModified: stats.mtime,
        },
      });

      return NextResponse.json({
        name: filename,
        workspaceId,
        workspaceName: formatWorkspaceName(workspaceId),
        path: filePath,
        content,
        lastModified: stats.mtime.toISOString(),
        size: stats.size,
      });
    } catch (fsError) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

// Sync filesystem files to database (for local development)
async function syncFilesystemToDatabase(): Promise<number> {
  try {
    // Check if workspace path exists
    try {
      await fs.access(WORKSPACE_PATH);
    } catch {
      console.log('Workspace path not accessible (Vercel environment), skipping filesystem sync');
      return 0;
    }

    let syncedCount = 0;
    const workspaces = ['root', 'personal', 'business', 'memory', 'skills'];

    for (const workspaceId of workspaces) {
      const dirPath = workspaceId === 'root' ? WORKSPACE_PATH : path.join(WORKSPACE_PATH, workspaceId);
      
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const mdFiles = entries
          .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
          .map(entry => entry.name);

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
          } catch (fileError) {
            console.error(`Error syncing file ${filename}:`, fileError);
          }
        }
      } catch (dirError) {
        // Directory doesn't exist, skip
      }
    }

    console.log(`Synced ${syncedCount} files to database`);
    return syncedCount;
  } catch (error) {
    console.error('Error syncing filesystem to database:', error);
    return 0;
  }
}

// Format workspace name for display
function formatWorkspaceName(name: string): string {
  if (name === 'root') return 'Root Workspace';
  // Convert kebab-case or snake_case to Title Case
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
