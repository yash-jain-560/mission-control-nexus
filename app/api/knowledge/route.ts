import { NextRequest, NextResponse } from 'next/server';
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
];

// GET /api/knowledge - List all knowledge files
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const file = searchParams.get('file');

    // If file is specified, return that file's content
    if (file) {
      return getFileContent(file);
    }

    // Otherwise, list all knowledge files
    const files: any[] = [];

    for (const filename of KNOWLEDGE_FILES) {
      const filePath = path.join(WORKSPACE_PATH, filename);
      try {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        files.push({
          name: filename,
          path: filePath,
          content,
          lastModified: stats.mtime.toISOString(),
          size: stats.size,
        });
      } catch {
        // File doesn't exist, skip
      }
    }

    // Also check for any other .md files in the workspace
    try {
      const workspaceFiles = await fs.readdir(WORKSPACE_PATH);
      const mdFiles = workspaceFiles.filter(f => f.endsWith('.md') && !KNOWLEDGE_FILES.includes(f));

      for (const filename of mdFiles) {
        const filePath = path.join(WORKSPACE_PATH, filename);
        try {
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          files.push({
            name: filename,
            path: filePath,
            content,
            lastModified: stats.mtime.toISOString(),
            size: stats.size,
          });
        } catch {
          // Skip
        }
      }
    } catch {
      // Error reading directory
    }

    // Sort by name
    files.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      files,
      totalSize: files.reduce((acc, f) => acc + f.size, 0),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching knowledge files:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge files' }, { status: 500 });
  }
}

// GET helper for single file
async function getFileContent(filename: string) {
  try {
    // Security: only allow .md files and prevent directory traversal
    if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(WORKSPACE_PATH, filename);
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');

    return NextResponse.json({
      name: filename,
      path: filePath,
      content,
      lastModified: stats.mtime.toISOString(),
      size: stats.size,
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
