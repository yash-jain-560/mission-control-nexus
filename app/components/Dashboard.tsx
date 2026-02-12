'use client'

import { useEffect, useMemo, useState } from 'react'
import { AgentCard } from '@/app/components/AgentCard'
import { ActivityFeed } from '@/app/components/ActivityFeed'

type AgentApi = {
  id: string
  agentId: string
  name: string
  type: string
  status: string
  metadata?: { model?: string; tokenUsage?: number }
  lastHeartbeat: string
}

type Ticket = { id: string; title: string; status: string; assigneeId?: string | null }

type Activity = { id: string; type: 'agent' | 'ticket' | 'system'; message: string; timestamp: string }

export function Dashboard() {
  const [agents, setAgents] = useState<AgentApi[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

  const load = async () => {
    const [aRes, tRes] = await Promise.all([fetch('/api/agents'), fetch('/api/tickets')])
    const aJson = await aRes.json()
    const tJson = await tRes.json()
    setAgents(aJson.agents || [])
    setTickets(tJson.tickets || [])
  }

  useEffect(() => {
    load().catch(() => undefined)
    const evt = new EventSource('/api/events')
    evt.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload.type === 'snapshot') {
          setAgents(payload.agents || [])
          setTickets(payload.tickets || [])
          setActivities(payload.activities || [])
        }
        if (payload.type === 'activity' && payload.activity) {
          setActivities((prev) => [payload.activity, ...prev].slice(0, 40))
        }
      } catch {
        // noop
      }
    }
    return () => evt.close()
  }, [])

  const summary = useMemo(() => {
    const total = agents.length
    const active = agents.filter((a) => ['ONLINE', 'BUSY', 'WORKING', 'ACTIVE'].includes(a.status.toUpperCase())).length
    const idle = agents.filter((a) => a.status.toUpperCase().includes('IDLE')).length
    const offline = total - active - idle
    const done = tickets.filter((t) => t.status === 'Done').length
    const health = total === 0 ? 'Unknown' : offline > total / 2 ? 'Degraded' : 'Healthy'
    const tokenUsage = agents.reduce((acc, a) => acc + (Number(a.metadata?.tokenUsage) || 0), 0)
    return { total, active, idle, offline, done, health, tokenUsage }
  }, [agents, tickets])

  return (
    <main className="p-4 md:p-6">
      <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Mission Control Nexus</h1>
          <p className="text-slate-400">Real-time command center for agents and tickets</p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4 mb-6">
        <div className="card p-4"><p className="text-sm text-slate-400">Total Agents</p><p className="text-2xl font-semibold">{summary.total}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-400">Tickets</p><p className="text-2xl font-semibold">{tickets.length} <span className="text-base text-slate-400">({summary.done} done)</span></p></div>
        <div className="card p-4"><p className="text-sm text-slate-400">System Health</p><p className="text-2xl font-semibold">{summary.health}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-400">Total Tokens</p><p className="text-2xl font-semibold">{summary.tokenUsage.toLocaleString()}</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300">Active {summary.active}</span>
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-300">Idle {summary.idle}</span>
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-red-300">Offline {summary.offline}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <AgentCard
                key={a.id}
                agent={{
                  id: a.id,
                  agentId: a.agentId,
                  name: a.name,
                  type: a.type,
                  status: a.status,
                  model: a.metadata?.model,
                  tokenUsage: a.metadata?.tokenUsage,
                  lastHeartbeat: a.lastHeartbeat,
                  assignedTickets: tickets.filter((t) => t.assigneeId === a.agentId).map((t) => ({ id: t.id, title: t.title, status: t.status })),
                  recentActivities: activities.filter((x) => x.message.includes(a.name)).slice(0, 8).map((x) => ({ id: x.id, message: x.message, timestamp: x.timestamp })),
                  statusHistory: activities.filter((x) => x.type === 'agent' && x.message.includes(a.name)).slice(0, 8).map((x) => ({ id: x.id, status: a.status, timestamp: x.timestamp })),
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
