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
  'HEARTBEAT.md',
];

interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  files: KnowledgeFile[];
}

interface KnowledgeFile {
  name: string;
  workspaceId: string;
  workspaceName: string;
  path: string;
  content: string;
  lastModified: string;
  size: number;
}

// GET /api/knowledge - List all knowledge files across workspaces
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const file = searchParams.get('file');
    const workspace = searchParams.get('workspace');
    const format = searchParams.get('format') || 'tree'; // 'tree' or 'flat'

    // If file is specified, return that file's content
    if (file) {
      return getFileContent(file, workspace || undefined);
    }

    // Scan for all workspaces
    const workspaces = await scanWorkspaces();
    
    // If workspace specified, filter to just that one
    const targetWorkspaces = workspace 
      ? workspaces.filter(w => w.id === workspace)
      : workspaces;

    // Flatten files for 'flat' format
    if (format === 'flat') {
      const allFiles = targetWorkspaces.flatMap(w => w.files);
      allFiles.sort((a, b) => a.name.localeCompare(b.name));
      
      return NextResponse.json({
        files: allFiles,
        workspaces: targetWorkspaces.map(w => ({ id: w.id, name: w.name })),
        totalSize: allFiles.reduce((acc, f) => acc + f.size, 0),
        totalFiles: allFiles.length,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Tree format (default)
    return NextResponse.json({
      workspaces: targetWorkspaces,
      totalFiles: targetWorkspaces.reduce((acc, w) => acc + w.files.length, 0),
      totalSize: targetWorkspaces.reduce((acc, w) => acc + w.files.reduce((facc, f) => facc + f.size, 0), 0),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching knowledge files:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge files' }, { status: 500 });
  }
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

    // Determine the file path
    let filePath: string;
    if (workspace) {
      const workspacePath = path.join(WORKSPACE_PATH, workspace);
      // Verify workspace exists and is a directory
      try {
        const stats = await fs.stat(workspacePath);
        if (!stats.isDirectory()) {
          return NextResponse.json({ error: 'Invalid workspace' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      filePath = path.join(workspacePath, file);
    } else {
      filePath = path.join(WORKSPACE_PATH, file);
    }

    // Ensure the path is still within workspace
    const resolvedPath = path.resolve(filePath);
    const resolvedWorkspace = path.resolve(WORKSPACE_PATH);
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Write the file
    await fs.writeFile(filePath, content, 'utf-8');

    // Get updated stats
    const stats = await fs.stat(filePath);

    return NextResponse.json({
      name: file,
      workspaceId: workspace || 'root',
      workspaceName: workspace || 'Root Workspace',
      path: filePath,
      content,
      lastModified: stats.mtime.toISOString(),
      size: stats.size,
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

    // Determine the file path
    let filePath: string;
    if (workspace) {
      const workspacePath = path.join(WORKSPACE_PATH, workspace);
      filePath = path.join(workspacePath, file);
    } else {
      filePath = path.join(WORKSPACE_PATH, file);
    }

    // Check if file already exists
    try {
      await fs.access(filePath);
      return NextResponse.json({ error: 'File already exists' }, { status: 409 });
    } catch {
      // File doesn't exist, good to proceed
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    await fs.writeFile(filePath, content, 'utf-8');

    return NextResponse.json({
      name: file,
      workspaceId: workspace || 'root',
      workspaceName: workspace || 'Root Workspace',
      path: filePath,
      content,
      lastModified: new Date().toISOString(),
      size: Buffer.byteLength(content, 'utf-8'),
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

    // Determine the file path
    let filePath: string;
    if (workspace) {
      const workspacePath = path.join(WORKSPACE_PATH, workspace);
      filePath = path.join(workspacePath, file);
    } else {
      filePath = path.join(WORKSPACE_PATH, file);
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete the file
    await fs.unlink(filePath);

    return NextResponse.json({
      message: 'File deleted successfully',
      name: file,
      workspaceId: workspace || 'root',
    });
  } catch (error) {
    console.error('Error deleting knowledge file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

// Scan for all workspaces and their knowledge files
async function scanWorkspaces(): Promise<WorkspaceInfo[]> {
  const workspaces: WorkspaceInfo[] = [];

  // Always include root workspace
  const rootFiles = await scanDirectory(WORKSPACE_PATH, 'root', 'Root Workspace');
  workspaces.push({
    id: 'root',
    name: 'Root Workspace',
    path: WORKSPACE_PATH,
    files: rootFiles,
  });

  // Scan for agent directories (subdirectories with .md files)
  try {
    const entries = await fs.readdir(WORKSPACE_PATH, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(WORKSPACE_PATH, entry.name);
        const dirFiles = await scanDirectory(dirPath, entry.name, entry.name);
        
        if (dirFiles.length > 0) {
          workspaces.push({
            id: entry.name,
            name: formatWorkspaceName(entry.name),
            path: dirPath,
            files: dirFiles,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning workspaces:', error);
  }

  return workspaces;
}

// Scan a directory for knowledge files
async function scanDirectory(dirPath: string, workspaceId: string, workspaceName: string): Promise<KnowledgeFile[]> {
  const files: KnowledgeFile[] = [];

  // First check for known knowledge files
  for (const filename of KNOWLEDGE_FILES) {
    const filePath = path.join(dirPath, filename);
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const content = await fs.readFile(filePath, 'utf-8');
        files.push({
          name: filename,
          workspaceId,
          workspaceName,
          path: filePath,
          content,
          lastModified: stats.mtime.toISOString(),
          size: stats.size,
        });
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  // Also check for any other .md files in the directory
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const mdFiles = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !KNOWLEDGE_FILES.includes(entry.name))
      .map(entry => entry.name);

    for (const filename of mdFiles) {
      const filePath = path.join(dirPath, filename);
      try {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        files.push({
          name: filename,
          workspaceId,
          workspaceName,
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

  return files;
}

// GET helper for single file
async function getFileContent(filename: string, workspace?: string) {
  try {
    // Security: only allow .md files and prevent directory traversal
    if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = workspace 
      ? path.join(WORKSPACE_PATH, workspace, filename)
      : path.join(WORKSPACE_PATH, filename);
    
    // Ensure the path is still within workspace
    const resolvedPath = path.resolve(filePath);
    const resolvedWorkspace = path.resolve(WORKSPACE_PATH);
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }

    const content = await fs.readFile(filePath, 'utf-8');

    return NextResponse.json({
      name: filename,
      workspaceId: workspace || 'root',
      workspaceName: workspace || 'Root Workspace',
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

// Format workspace name for display
function formatWorkspaceName(name: string): string {
  // Convert kebab-case or snake_case to Title Case
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}