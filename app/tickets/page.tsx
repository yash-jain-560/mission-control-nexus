'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Kanban } from '@/app/components/Kanban'

type Ticket = {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  assigneeId?: string | null
  dueDate?: string
  createdAt: string
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
  const [newTicketTitle, setNewTicketTitle] = useState('')
  const [newTicketPriority, setNewTicketPriority] = useState('MEDIUM')
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)

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
        setAgents(data.agents)
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
    return tickets.filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterAssignee && t.assigneeId !== filterAssignee) return false
      return true
    })
  }, [tickets, filterStatus, filterPriority, filterAssignee])

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

  return (
    <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
      <header className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Tickets</h1>
            <p className="text-slate-400 mt-1">Manage and track all tickets</p>
          </div>
          <button
            onClick={() => setShowNewTicketForm(!showNewTicketForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            + New Ticket
          </button>
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
        <div className="flex gap-3 flex-wrap mb-6">
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
        </div>
      </header>

      {/* Tickets View */}
      <div className="grid gap-3">
        {filteredTickets.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
            <p className="text-slate-400">No tickets match your filters</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-white">{ticket.title}</h3>
                  {ticket.description && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{ticket.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className={`text-xs px-3 py-1 rounded font-semibold ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span className={`text-xs px-3 py-1 rounded ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
              </div>
              {ticket.dueDate && (
                <p className="text-xs text-slate-500 mt-3">Due: {new Date(ticket.dueDate).toLocaleDateString()}</p>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  )
}
