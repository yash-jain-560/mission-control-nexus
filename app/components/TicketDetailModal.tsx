'use client'

import { useState, useEffect } from 'react'
import { formatRelativeTime } from '@/lib/utils'

interface TicketDetail {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  assigneeId?: string
  assignee?: {
    id: string
    name: string
    type: string
    status: string
  }
  reporterId: string
  totalInputTokens: number
  totalOutputTokens: number
  createdAt: string
  updatedAt: string
  dueDate?: string
  tags: string[]
  history: Array<{
    id: string
    changeType: string
    fromValue?: any
    toValue?: any
    changedBy: string
    timestamp: string
  }>
  comments: Array<{
    id: string
    authorId: string
    content: string
    timestamp: string
  }>
  tokenUsage: {
    totalInput: number
    totalOutput: number
    total: number
    byActivity: Array<{
      id: string
      agentId: string
      activityType: string
      inputTokens: number
      outputTokens: number
      totalTokens: number
      timestamp: string
    }>
  }
  statusTimeline: Array<{
    id: string
    timestamp: string
    fromStatus?: string
    toStatus: string
    changedBy: string
  }>
}

interface TicketDetailModalProps {
  ticketId: string
  onClose: () => void
}

export function TicketDetailModal({ ticketId, onClose }: TicketDetailModalProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'tokens' | 'timeline'>('overview')

  useEffect(() => {
    loadTicket()
  }, [ticketId])

  const loadTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`)
      if (res.ok) {
        const data = await res.json()
        setTicket(data)
      }
    } catch (error) {
      console.error('Failed to load ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'text-red-400 bg-red-500/10 border-red-500/30'
      case 'HIGH':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
      case 'MEDIUM':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
        return 'text-emerald-400 bg-emerald-500/10'
      case 'InProgress':
        return 'text-blue-400 bg-blue-500/10'
      case 'Review':
        return 'text-purple-400 bg-purple-500/10'
      case 'Assigned':
        return 'text-amber-400 bg-amber-500/10'
      default:
        return 'text-slate-400 bg-slate-500/10'
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={onClose}>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8" onClick={(e) => e.stopPropagation()}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-slate-400 mt-4">Loading ticket details...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={onClose}>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8" onClick={(e) => e.stopPropagation()}>
          <p className="text-red-400">Failed to load ticket</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-800 rounded text-white">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-3 py-1 rounded font-semibold border ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
              <span className={`text-xs px-3 py-1 rounded ${getStatusColor(ticket.status)}`}>
                {ticket.status}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white">{ticket.title}</h2>
            <p className="text-sm text-slate-500 mt-1">ID: {ticket.id}</p>
          </div>
          <button className="text-slate-400 hover:text-white text-2xl" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {(['overview', 'history', 'tokens', 'timeline'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Description */}
              {ticket.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-2">Description</h3>
                  <p className="text-slate-300">{ticket.description}</p>
                </div>
              )}

              {/* Assignee & Reporter */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Assignee</p>
                  <p className="text-white font-medium">
                    {ticket.assignee ? ticket.assignee.name : 'Unassigned'}
                  </p>
                  {ticket.assignee && (
                    <p className="text-xs text-slate-500">{ticket.assignee.type}</p>
                  )}
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Reporter</p>
                  <p className="text-white font-medium">{ticket.reporterId}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Created</p>
                  <p className="text-sm text-slate-300">{new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Updated</p>
                  <p className="text-sm text-slate-300">{new Date(ticket.updatedAt).toLocaleString()}</p>
                </div>
                {ticket.dueDate && (
                  <div>
                    <p className="text-xs text-slate-500">Due Date</p>
                    <p className="text-sm text-slate-300">{new Date(ticket.dueDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {ticket.tags.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Tags</p>
                  <div className="flex gap-2 flex-wrap">
                    {ticket.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 bg-slate-800 text-slate-300 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Token Summary */}
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-slate-400 mb-3">Token Usage Summary</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Input</p>
                    <p className="text-lg font-semibold text-emerald-400">{ticket.tokenUsage.totalInput.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Output</p>
                    <p className="text-lg font-semibold text-blue-400">{ticket.tokenUsage.totalOutput.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-semibold text-white">{ticket.tokenUsage.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {ticket.history.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No history entries</p>
              ) : (
                ticket.history.map((entry) => (
                  <div key={entry.id} className="bg-slate-800/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{entry.changeType}</span>
                      <span className="text-xs text-slate-500">{formatRelativeTime(entry.timestamp)}</span>
                    </div>
                    {entry.changeType === 'STATUS_CHANGE' && (
                      <p className="text-sm text-slate-400">
                        {entry.fromValue?.status} → {entry.toValue?.status}
                      </p>
                    )}
                    {entry.changeType === 'ASSIGNMENT_CHANGE' && (
                      <p className="text-sm text-slate-400">
                        {entry.fromValue?.assigneeId || 'Unassigned'} → {entry.toValue?.assigneeId || 'Unassigned'}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-2">by {entry.changedBy}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'tokens' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                  <p className="text-xs text-slate-500">Total Input</p>
                  <p className="text-2xl font-semibold text-emerald-400">{ticket.tokenUsage.totalInput.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                  <p className="text-xs text-slate-500">Total Output</p>
                  <p className="text-2xl font-semibold text-blue-400">{ticket.tokenUsage.totalOutput.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-2xl font-semibold text-white">{ticket.tokenUsage.total.toLocaleString()}</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-400 mt-6 mb-3">Activity Breakdown</h3>
              <div className="space-y-2">
                {ticket.tokenUsage.byActivity.map((activity) => (
                  <div key={activity.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{activity.activityType}</p>
                      <p className="text-xs text-slate-500">{formatRelativeTime(activity.timestamp)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{activity.totalTokens.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">
                        <span className="text-emerald-400">↑{activity.inputTokens.toLocaleString()}</span>
                        {' '}
                        <span className="text-blue-400">↓{activity.outputTokens.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-3">
              {ticket.statusTimeline.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No status changes</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-700"></div>
                  {ticket.statusTimeline.map((entry, index) => (
                    <div key={entry.id} className="relative pl-8 py-3">
                      <div className="absolute left-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-slate-900"></div>
                      <div className="bg-slate-800/50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">
                            {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : `Created as ${entry.toStatus}`}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">by {entry.changedBy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
