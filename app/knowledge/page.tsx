'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'

interface KnowledgeFile {
  name: string
  path: string
  content: string
  lastModified: string
  size: number
}

export default function KnowledgePage() {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const res = await fetch('/api/knowledge')
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to load knowledge files:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Simple markdown syntax highlighting
  const highlightMarkdown = (content: string) => {
    return content
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-slate-200 mt-5 mb-3">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-slate-300 mt-4 mb-2">$1</h3>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 text-slate-300">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-800 text-emerald-400 px-1 rounded text-sm">$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-800 p-3 rounded-lg overflow-x-auto my-3"><code class="text-slate-300 text-sm">$1</code></pre>')
      .replace(/\n/g, '<br/>')
  }

  const getFileIcon = (name: string) => {
    if (name.includes('SOUL')) return '🧠'
    if (name.includes('USER')) return '👤'
    if (name.includes('AGENTS')) return '🤖'
    if (name.includes('MEMORY')) return '🧠'
    if (name.includes('TOOLS')) return '🛠️'
    if (name.includes('IDENTITY')) return '🆔'
    if (name.includes('BOOTSTRAP')) return '🚀'
    return '📄'
  }

  const getFileDescription = (name: string) => {
    if (name.includes('SOUL')) return 'Agent persona and personality'
    if (name.includes('USER')) return 'User profile and preferences'
    if (name.includes('AGENTS')) return 'Operating instructions for agents'
    if (name.includes('MEMORY')) return 'Long-term memory storage'
    if (name.includes('TOOLS')) return 'Tool notes and documentation'
    if (name.includes('IDENTITY')) return 'Agent identity configuration'
    if (name.includes('BOOTSTRAP')) return 'Initialization instructions'
    return 'Documentation file'
  }

  if (loading) {
    return (
      <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
      <header className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Knowledge Base</h1>
            <p className="text-slate-400 mt-1">Workspace documentation and memory files</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* File List */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Files ({filteredFiles.length})
          </h2>
          {filteredFiles.length === 0 ? (
            <p className="text-slate-500 text-sm">No files found</p>
          ) : (
            filteredFiles.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedFile?.name === file.name
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getFileIcon(file.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-500 truncate">{getFileDescription(file.name)}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {formatRelativeTime(file.lastModified)} · {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* File Content */}
        <div>
          {selectedFile ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              {/* File Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getFileIcon(selectedFile.name)}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedFile.name}</h2>
                    <p className="text-xs text-slate-500">
                      Last modified: {new Date(selectedFile.lastModified).toLocaleString()} · {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/knowledge?file=${selectedFile.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  View Raw
                </a>
              </div>

              {/* File Content */}
              <div className="p-6 overflow-auto max-h-[70vh]">
                <div
                  className="prose prose-invert prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: highlightMarkdown(selectedFile.content) }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
              <span className="text-6xl mb-4 block">📚</span>
              <h2 className="text-xl font-semibold text-white mb-2">Select a file to view</h2>
              <p className="text-slate-400">Choose a documentation file from the sidebar to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
