'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatRelativeTime } from '@/lib/utils';

interface KnowledgeFile {
  name: string;
  workspaceId: string;
  workspaceName: string;
  path: string;
  content: string;
  lastModified: string;
  size: number;
}

interface Workspace {
  id: string;
  name: string;
  path: string;
  files: KnowledgeFile[];
}

interface Tab {
  id: string;
  file: KnowledgeFile;
  isDirty: boolean;
  originalContent: string;
}

export default function KnowledgePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSystemFiles, setShowSystemFiles] = useState(false);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set(['root']));
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'edit'>('split');

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/knowledge?format=tree');
      if (!res.ok) throw new Error('Failed to load knowledge files');
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Get all files or filtered by workspace
  const getFiles = useCallback((): KnowledgeFile[] => {
    if (selectedWorkspace === 'all') {
      return workspaces.flatMap(w => w.files);
    }
    return workspaces.find(w => w.id === selectedWorkspace)?.files || [];
  }, [workspaces, selectedWorkspace]);

  // Filter files by search
  const filteredFiles = getFiles().filter(file => {
    const matchesSearch = 
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSystemFilter = showSystemFiles || !isSystemFile(file.name);
    return matchesSearch && matchesSystemFilter;
  });

  // Open file in tab
  const openFile = (file: KnowledgeFile) => {
    const tabId = `${file.workspaceId}/${file.name}`;
    
    // Check if tab already exists
    const existingTab = tabs.find(t => t.id === tabId);
    if (existingTab) {
      setActiveTabId(tabId);
      setEditContent(existingTab.file.content);
      return;
    }

    // Create new tab
    const newTab: Tab = {
      id: tabId,
      file,
      isDirty: false,
      originalContent: file.content,
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    setEditContent(file.content);
    setIsEditing(false);
  };

  // Close tab
  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isDirty && !confirm('You have unsaved changes. Close anyway?')) {
      return;
    }
    
    setTabs(prev => prev.filter(t => t.id !== tabId));
    
    if (activeTabId === tabId) {
      const remainingTabs = tabs.filter(t => t.id !== tabId);
      setActiveTabId(remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null);
      if (remainingTabs.length > 0) {
        setEditContent(remainingTabs[remainingTabs.length - 1].file.content);
      }
    }
  };

  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setEditContent(newContent);
    
    if (activeTab) {
      const isDirty = newContent !== activeTab.originalContent;
      setTabs(prev => prev.map(t => 
        t.id === activeTab.id 
          ? { ...t, isDirty, file: { ...t.file, content: newContent } }
          : t
      ));
    }
  };

  // Save file
  const saveFile = async () => {
    if (!activeTab) return;
    
    try {
      setSaving(true);
      const res = await fetch('/api/knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: activeTab.file.name,
          workspace: activeTab.file.workspaceId === 'root' ? '' : activeTab.file.workspaceId,
          content: editContent,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      // Update tab state
      setTabs(prev => prev.map(t => 
        t.id === activeTab.id 
          ? { ...t, isDirty: false, originalContent: editContent }
          : t
      ));
      
      // Refresh workspaces to get updated timestamps
      await loadWorkspaces();
      
      // Show success feedback
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Create new file
  const createNewFile = async () => {
    const name = prompt('Enter file name (e.g., NOTES.md):');
    if (!name) return;
    
    const workspace = selectedWorkspace === 'all' ? '' : selectedWorkspace;
    
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: name.endsWith('.md') ? name : `${name}.md`,
          workspace,
          content: `# ${name.replace('.md', '')}\n\n`,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to create file');
      
      const newFile = await res.json();
      await loadWorkspaces();
      openFile(newFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
    }
  };

  // Delete file
  const deleteFile = async (file: KnowledgeFile) => {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
    
    try {
      const workspace = file.workspaceId === 'root' ? '' : file.workspaceId;
      const res = await fetch(`/api/knowledge?file=${file.name}&workspace=${workspace}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to delete file');
      
      // Close tab if open
      const tabId = `${file.workspaceId}/${file.name}`;
      closeTab(tabId);
      
      await loadWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  // Toggle workspace expansion
  const toggleWorkspace = (workspaceId: string) => {
    setExpandedWorkspaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workspaceId)) {
        newSet.delete(workspaceId);
      } else {
        newSet.add(workspaceId);
      }
      return newSet;
    });
  };

  // Get file icon
  const getFileIcon = (name: string) => {
    if (name.includes('SOUL')) return '🧠';
    if (name.includes('USER')) return '👤';
    if (name.includes('AGENTS')) return '🤖';
    if (name.includes('MEMORY')) return '🧠';
    if (name.includes('TOOLS')) return '🛠️';
    if (name.includes('IDENTITY')) return '🆔';
    if (name.includes('BOOTSTRAP')) return '🚀';
    if (name.includes('HEARTBEAT')) return '💓';
    return '📄';
  };

  // Get file description
  const getFileDescription = (name: string) => {
    if (name.includes('SOUL')) return 'Agent persona and personality';
    if (name.includes('USER')) return 'User profile and preferences';
    if (name.includes('AGENTS')) return 'Operating instructions for agents';
    if (name.includes('MEMORY')) return 'Long-term memory storage';
    if (name.includes('TOOLS')) return 'Tool notes and documentation';
    if (name.includes('IDENTITY')) return 'Agent identity configuration';
    if (name.includes('BOOTSTRAP')) return 'Initialization instructions';
    if (name.includes('HEARTBEAT')) return 'Periodic check configuration';
    return 'Documentation file';
  };

  // Check if file is a system file
  const isSystemFile = (name: string) => {
    return ['SOUL.md', 'USER.md', 'AGENTS.md', 'MEMORY.md', 'TOOLS.md', 'IDENTITY.md', 'BOOTSTRAP.md', 'HEARTBEAT.md'].includes(name);
  };

  // Syntax highlighting for markdown
  const highlightMarkdown = (content: string) => {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-slate-200 mt-5 mb-3">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-slate-300 mt-4 mb-2">$1</h3>')
      .replace(/^#### (.*$)/gim, '<h4 class="text-md font-bold text-slate-300 mt-3 mb-2">$1</h4>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 text-slate-300">$1</li>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 text-slate-300">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 text-slate-300"><span class="text-blue-400">$&</span></li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-800 p-4 rounded-lg overflow-x-auto my-4 border border-slate-700"><code class="text-slate-300 text-sm font-mono block">$1</code></pre>')
      .replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-4 py-1 my-3 text-slate-300 italic bg-slate-800/30">$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br/>');
  };

  if (loading && workspaces.length === 0) {
    return (
      <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6 bg-slate-950 min-h-screen flex flex-col">
      {/* Header */}
      <header className="mb-6 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Knowledge Base</h1>
            <p className="text-slate-400 mt-1">Multi-workspace documentation and memory files</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={createNewFile}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <span>+</span> New File
            </button>
            <button
              onClick={loadWorkspaces}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Workspace Selector */}
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:border-blue-500 outline-none"
          >
            <option value="all">All Workspaces</option>
            {workspaces.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {/* System Files Toggle */}
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={showSystemFiles}
              onChange={(e) => setShowSystemFiles(e.target.checked)}
              className="rounded border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-300">Show System Files</span>
          </label>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-red-200">×</button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Sidebar - File Tree */}
        <aside className="w-72 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Files ({filteredFiles.length})
            </h2>
          </div>
          
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {filteredFiles.length === 0 ? (
              <p className="text-slate-500 text-sm p-2">No files found</p>
            ) : (
              selectedWorkspace === 'all' ? (
                // Group by workspace
                workspaces.map(workspace => {
                  const workspaceFiles = workspace.files.filter(file => {
                    const matchesSearch = 
                      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      file.content.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesSystemFilter = showSystemFiles || !isSystemFile(file.name);
                    return matchesSearch && matchesSystemFilter;
                  });
                  
                  if (workspaceFiles.length === 0) return null;
                  
                  const isExpanded = expandedWorkspaces.has(workspace.id);
                  
                  return (
                    <div key={workspace.id}>
                      <button
                        onClick={() => toggleWorkspace(workspace.id)}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-800 text-left"
                      >
                        <span className="text-slate-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                        <span className="text-sm font-medium text-slate-300">{workspace.name}</span>
                        <span className="text-xs text-slate-500 ml-auto">{workspaceFiles.length}</span>
                      </button>
                      
                      {isExpanded && (
                        <div className="ml-4 space-y-1">
                          {workspaceFiles.map(file => (
                            <FileItem
                              key={`${file.workspaceId}/${file.name}`}
                              file={file}
                              isActive={activeTabId === `${file.workspaceId}/${file.name}`}
                              onClick={() => openFile(file)}
                              onDelete={() => deleteFile(file)}
                              getFileIcon={getFileIcon}
                              getFileDescription={getFileDescription}
                              formatRelativeTime={formatRelativeTime}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // Flat list for single workspace
                filteredFiles.map(file => (
                  <FileItem
                    key={`${file.workspaceId}/${file.name}`}
                    file={file}
                    isActive={activeTabId === `${file.workspaceId}/${file.name}`}
                    onClick={() => openFile(file)}
                    onDelete={() => deleteFile(file)}
                    getFileIcon={getFileIcon}
                    getFileDescription={getFileDescription}
                    formatRelativeTime={formatRelativeTime}
                  />
                ))
              )
            )}
          </div>
        </aside>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tabs */}
          {tabs.length > 0 && (
            <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setEditContent(tab.file.content);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer text-sm whitespace-nowrap transition-colors ${
                    activeTabId === tab.id
                      ? 'bg-slate-900 border-t border-x border-slate-800 text-white'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span>{tab.isDirty && '●'}</span>
                  <span>{tab.file.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Editor/Preview Area */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
            {activeTab ? (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getFileIcon(activeTab.file.name)}</span>
                    <div>
                      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        {activeTab.file.name}
                        {activeTab.isDirty && <span className="text-amber-400 text-sm">●</span>}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {activeTab.file.workspaceName} · {formatRelativeTime(activeTab.file.lastModified)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex bg-slate-800 rounded-lg p-1">
                      {(['split', 'preview', 'edit'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode)}
                          className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                            viewMode === mode
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    
                    {/* Edit/Save Buttons */}
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        isEditing
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      }`}
                    >
                      {isEditing ? 'Preview' : 'Edit'}
                    </button>
                    
                    {(isEditing || activeTab.isDirty) && (
                      <button
                        onClick={saveFile}
                        disabled={saving || !activeTab.isDirty}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-sm font-medium transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  {isEditing ? (
                    // Edit Mode
                    <textarea
                      value={editContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      className="w-full h-full p-6 bg-slate-950 text-slate-200 font-mono text-sm resize-none outline-none"
                      spellCheck={false}
                    />
                  ) : (
                    // Preview Mode
                    <div 
                      className="w-full h-full p-6 overflow-auto prose prose-invert prose-slate max-w-none"
                      dangerouslySetInnerHTML={{ __html: highlightMarkdown(editContent) }}
                    />
                  )}
                </div>
              </>
            ) : (
              // Empty State
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-12">
                  <span className="text-6xl mb-4 block">📚</span>
                  <h2 className="text-xl font-semibold text-white mb-2">Select a file to view</h2>
                  <p className="text-slate-400">Choose a documentation file from the sidebar to view or edit its contents</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// File Item Component
interface FileItemProps {
  file: KnowledgeFile;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  getFileIcon: (name: string) => string;
  getFileDescription: (name: string) => string;
  formatRelativeTime: (date: string) => string;
}

function FileItem({ file, isActive, onClick, onDelete, getFileIcon, getFileDescription, formatRelativeTime }: FileItemProps) {
  const [showActions, setShowActions] = useState(false);
  
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`group w-full text-left p-2 rounded border transition-all cursor-pointer ${
        isActive
          ? 'bg-blue-500/10 border-blue-500/50'
          : 'bg-transparent border-transparent hover:bg-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{getFileIcon(file.name)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{file.name}</p>
          <p className="text-xs text-slate-500 truncate">{getFileDescription(file.name)}</p>
          <p className="text-xs text-slate-600">
            {formatRelativeTime(file.lastModified)} · {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        {showActions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete file"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}