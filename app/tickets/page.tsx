'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Kanban } from '@/app/components/Kanban'
import { TicketDetailModal } from '@/app/components/TicketDetailModal'
import { formatRelativeTime } from '@/lib/utils'

type Ticket = {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  assigneeId?: string | null
  dueDate?: string
  createdAt: string
  updatedAt: string
}

type Agent = {
  id: string
  name: string
}

type Summary = {
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  total: number
  completed: number
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [newTicketTitle, setNewTicketTitle] = useState('')
  const [newTicketPriority, setNewTicketPriority] = useState('MEDIUM')
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)
  const [sortBy, setSortBy] = useState<'createdAt' | 'priority' | 'status'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      const [ticketsRes, agentsRes] = await Promise.all([
        fetch('/api/tickets?summary=true'),
        fetch('/api/agents?limit=100'),
      ])

      if (ticketsRes.ok) {
        const data = await ticketsRes.json()
        setTickets(data.tickets)
        setSummary(data.summary)
      }

      if (agentsRes.ok) {
        const data = await agentsRes.json()
        setAgents(data.agents.map((a: any) => ({ id: a.id, name: a.name })))
      }
    }

    loadData()

    // Real-time updates via SSE
    const evt = new EventSource('/api/events')
    evt.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload.type === 'snapshot' && payload.tickets) {
          setTickets(payload.tickets)
        }
      } catch {
        // noop
      }
    }

    return () => evt.close()
  }, [])

  const filteredTickets = useMemo(() => {
    let filtered = tickets.filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterAssignee && t.assigneeId !== filterAssignee) return false
      return true
    })

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'priority':
          const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
          comparison = (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 0)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [tickets, filterStatus, filterPriority, filterAssignee, sortBy, sortOrder])

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTicketTitle) return

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTicketTitle,
          priority: newTicketPriority,
          status: 'Backlog',
        }),
      })

      if (res.ok) {
        const newTicket = await res.json()
        setTickets([newTicket, ...tickets])
        setNewTicketTitle('')
        setShowNewTicketForm(false)
      }
    } catch (error) {
      console.error('Failed to create ticket:', error)
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

  const getAssigneeName = (id?: string | null) => {
    if (!id) return 'Unassigned'
    const agent = agents.find(a => a.id === id)
    return agent?.name || id
  }

  return (
    <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
      <header className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Tickets</h1>
            <p className="text-slate-400 mt-1">Manage and track all tickets</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-slate-900 rounded-lg border border-slate-800 p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  viewMode === 'kanban' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Kanban
              </button>
            </div>
            <button
              onClick={() => setShowNewTicketForm(!showNewTicketForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              + New Ticket
            </button>
          </div>
        </div>

        {/* Create Ticket Form */}
        {showNewTicketForm && (
          <form
            onSubmit={handleCreateTicket}
            className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6"
          >
            <div className="grid gap-4">
              <input
                type="text"
                placeholder="Ticket title..."
                value={newTicketTitle}
                onChange={(e) => setNewTicketTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  value={newTicketPriority}
                  onChange={(e) => setNewTicketPriority(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:border-blue-500 outline-none"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="CRITICAL">Critical Priority</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition-colors"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewTicketForm(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Summary Stats */}
        {summary && (
          <div className="grid gap-3 md:grid-cols-5 mb-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-2xl font-bold text-white">{summary.total}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">{summary.completed}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">In Progress</p>
              <p className="text-2xl font-bold text-blue-400">{summary.byStatus.InProgress || 0}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">High Priority</p>
              <p className="text-2xl font-bold text-orange-400">
                {(summary.byPriority.HIGH || 0) + (summary.byPriority.CRITICAL || 0)}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">Completion Rate</p>
              <p className="text-2xl font-bold text-slate-100">
                {summary.total === 0 ? '0' : Math.round((summary.completed / summary.total) * 100)}%
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap mb-6 items-center">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Backlog">Backlog</option>
            <option value="Assigned">Assigned</option>
            <option value="InProgress">In Progress</option>
            <option value="Review">Review</option>
            <option value="Done">Done</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
          >
            <option value="">All Assignees</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>

          {/* Sort Controls */}
          {viewMode === 'list' && (
            <>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
              >
                <option value="createdAt">Sort by Date</option>
                <option value="priority">Sort by Priority</option>
                <option value="status">Sort by Status</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm hover:bg-slate-700"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </>
          )}

          {(filterStatus || filterPriority || filterAssignee) && (
            <button
              onClick={() => {
                setFilterStatus('')
                setFilterPriority('')
                setFilterAssignee('')
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors"
            >
              Clear Filters
            </button>
          )}

          <span className="ml-auto text-sm text-slate-500">
            Showing {filteredTickets.length} of {tickets.length} tickets
          </span>
        </div>
      </header>

      {/* Tickets View */}
      {viewMode === 'kanban' ? (
        <div className="bg-slate-950">
          <Kanban />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 bg-slate-800/50 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
            <span>Title</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Assignee</span>
            <span>Created</span>
          </div>

          {/* Table Body */}
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400">No tickets match your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ticket.title}</p>
                    {ticket.description && (
                      <p className="text-xs text-slate-500 truncate">{ticket.description}</p>
                    )}
                  </div>
                  <div>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <div>
                    <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-slate-300">{getAssigneeName(ticket.assigneeId)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(ticket.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      )}
    </main>
  )
}
