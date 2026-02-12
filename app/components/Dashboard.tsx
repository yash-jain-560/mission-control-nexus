'use client'

import { useEffect, useMemo, useState } from 'react'
import { AgentCard } from '@/app/components/AgentCard'
import { ActivityFeed } from '@/app/components/ActivityFeed'

type Agent = {
  id: string
  name: string
  type: string
  status: 'IDLE' | 'THINKING' | 'WORKING' | 'OFFLINE'
  isOnline: boolean
  tokensUsed: number
  tokensAvailable: number
  lastHeartbeat: string
  timeInCurrentStatus?: number
  metadata?: any
  recentActivities?: any[]
  assignedTickets?: any[]
  statusHistory?: any[]
  tokenStats?: {
    recent: number
    total: number
    input: number
    output: number
    cacheHits: number
  }
}

type Ticket = { id: string; title: string; status: string; priority: string; assigneeId?: string | null; dueDate?: string }

type Activity = {
  id: string
  agentId: string
  type: string
  message: string
  timestamp: string
  tokens?: number
  inputTokens?: number
  outputTokens?: number
  cacheHits?: number
  toolName?: string
  duration?: number
}

type Summary = {
  totalAgents: number
  onlineAgents: number
  offlineAgents: number
  totalTokensUsed: number
  systemHealth: string
  statusBreakdown?: Record<string, number>
}

export function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    const evt = new EventSource('/api/events')
    evt.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload.type === 'snapshot') {
          setAgents(payload.agents || [])
          setTickets(payload.tickets || [])
          setActivities(payload.activities || [])
          setSummary(payload.summary || null)
          setLastUpdate(new Date())
        }
      } catch {
        // noop
      }
    }
    evt.onerror = () => {
      evt.close()
    }
    return () => evt.close()
  }, [])

  const stats = useMemo(() => {
    if (!summary) return {
      total: 0,
      idle: 0,
      thinking: 0,
      working: 0,
      offline: 0,
      done: 0,
      health: 'Unknown',
      tokenUsage: 0
    }

    const done = tickets.filter((t) => t.status === 'Done').length
    const statusBreakdown = summary.statusBreakdown || {}

    return {
      total: summary.totalAgents,
      idle: statusBreakdown['IDLE'] || 0,
      thinking: statusBreakdown['THINKING'] || 0,
      working: statusBreakdown['WORKING'] || 0,
      offline: statusBreakdown['OFFLINE'] || summary.offlineAgents || 0,
      done,
      health: summary.systemHealth,
      tokenUsage: summary.totalTokensUsed,
    }
  }, [summary, tickets])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'IDLE': return '⏸️'
      case 'THINKING': return '🧠'
      case 'WORKING': return '⚡'
      case 'OFFLINE': return '💤'
      default: return '⚪'
    }
  }

  return (
    <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
      <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Mission Control Nexus</h1>
          <p className="text-slate-400">Real-time command center for agents and tickets</p>
        </div>
        {lastUpdate && (
          <div className="text-xs text-slate-500">
            Updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </header>

      {/* Stats Grid */}
      <section className="grid gap-3 md:grid-cols-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Agents</p>
          <p className="text-2xl font-semibold text-white">{stats.total}</p>
          <div className="flex gap-2 mt-2 text-xs">
            {stats.idle > 0 && <span className="text-emerald-400">{getStatusIcon('IDLE')} {stats.idle}</span>}
            {stats.thinking > 0 && <span className="text-amber-400">{getStatusIcon('THINKING')} {stats.thinking}</span>}
            {stats.working > 0 && <span className="text-blue-400">{getStatusIcon('WORKING')} {stats.working}</span>}
            {stats.offline > 0 && <span className="text-slate-400">{getStatusIcon('OFFLINE')} {stats.offline}</span>}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Tickets</p>
          <p className="text-2xl font-semibold text-white">
            {tickets.length} <span className="text-base text-slate-400">({stats.done} done)</span>
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">System Health</p>
          <p className={`text-2xl font-semibold ${stats.health === 'Healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {stats.health}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Tokens</p>
          <p className="text-2xl font-semibold text-white">{stats.tokenUsage.toLocaleString()}</p>
        </div>
      </section>

      {/* Main Content */}
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          {/* Status Legend */}
          <div className="mb-3 flex gap-2 text-xs flex-wrap">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300 border border-emerald-500/30">
              {getStatusIcon('IDLE')} IDLE
            </span>
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-300 border border-amber-500/30">
              {getStatusIcon('THINKING')} THINKING
            </span>
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-blue-300 border border-blue-500/30">
              {getStatusIcon('WORKING')} WORKING
            </span>
            <span className="rounded-full bg-slate-500/20 px-3 py-1 text-slate-300 border border-slate-500/30">
              {getStatusIcon('OFFLINE')} OFFLINE
            </span>
          </div>

          {/* Agent Grid */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={{
                  id: agent.id,
                  name: agent.name,
                  type: agent.type,
                  status: agent.status,
                  isOnline: agent.isOnline,
                  model: agent.metadata?.model,
                  tokensUsed: agent.tokensUsed,
                  tokensAvailable: agent.tokensAvailable,
                  lastHeartbeat: agent.lastHeartbeat,
                  timeInCurrentStatus: agent.timeInCurrentStatus,
                  statusHistory: agent.statusHistory,
                  tokenStats: agent.tokenStats,
                  assignedTickets: tickets.filter((t) => t.assigneeId === agent.id).map((t) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                  })),
                  recentActivities: activities
                    .filter((a) => a.agentId === agent.id)
                    .slice(0, 5)
                    .map((a) => ({
                      id: a.id,
                      message: a.message,
                      timestamp: a.timestamp,
                      tokens: a.tokens,
                      inputTokens: a.inputTokens,
                      outputTokens: a.outputTokens,
                    })),
                }}
              />
            ))}
          </div>
        </div>
        <ActivityFeed items={activities} />
      </section>
    </main>
  )
}
