'use client'

import { useMemo, useState } from 'react'
import { formatRelativeTime, statusTone } from '@/lib/utils'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

type Agent = {
  id: string
  agentId: string
  name: string
  type: string
  status: string
  model?: string
  tokenUsage?: number
  lastHeartbeat: string
  assignedTickets: Array<{ id: string; title: string; status: string }>
  recentActivities: Array<{ id: string; message: string; timestamp: string }>
  statusHistory: Array<{ id: string; status: string; timestamp: string }>
}

export function AgentCard({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false)
  const tokenSeries = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        step: i + 1,
        tokens: Math.max(0, Math.round((agent.tokenUsage || 2000) * (0.35 + Math.random() * 0.75))),
      })),
    [agent.tokenUsage],
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="card p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/60"
      >
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-100">{agent.name}</h4>
          <span className="text-xs text-slate-400">{agent.model || 'gpt-4'}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full animate-pulse-dot ${statusTone(agent.status).replace('text', 'bg')}`} />
          <span className={`text-sm capitalize ${statusTone(agent.status)}`}>{agent.status.toLowerCase()}</span>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-slate-300">
          <p>Tokens: {(agent.tokenUsage || 0).toLocaleString()}</p>
          <p className="text-slate-400">Last heartbeat: {formatRelativeTime(agent.lastHeartbeat)}</p>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 md:p-8" onClick={() => setOpen(false)}>
          <div
            className="mx-auto max-w-3xl card p-5 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">{agent.name}</h3>
                <p className="text-sm text-slate-400">{agent.agentId} · {agent.type}</p>
              </div>
              <button className="text-slate-400 hover:text-white" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-2">Token Usage Trend</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tokenSeries}>
                      <XAxis dataKey="step" hide />
                      <Tooltip />
                      <Area type="monotone" dataKey="tokens" stroke="#3b82f6" fill="#1d4ed8" fillOpacity={0.35} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-2">Status History</p>
                <ul className="space-y-2 max-h-40 overflow-auto text-sm">
                  {agent.statusHistory.slice(0, 8).map((h) => (
                    <li key={h.id} className="flex justify-between text-slate-300">
                      <span className="capitalize">{h.status.toLowerCase()}</span>
                      <span className="text-slate-500">{formatRelativeTime(h.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-2">Recent Activities</p>
                <ul className="space-y-2 text-sm max-h-40 overflow-auto">
                  {agent.recentActivities.slice(0, 8).map((a) => (
                    <li key={a.id} className="text-slate-200">
                      {a.message} <span className="text-slate-500">· {formatRelativeTime(a.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-2">Assigned Tickets</p>
                <ul className="space-y-2 text-sm max-h-40 overflow-auto">
                  {agent.assignedTickets.length === 0 ? (
                    <li className="text-slate-500">No assigned tickets</li>
                  ) : (
                    agent.assignedTickets.map((t) => (
                      <li key={t.id} className="flex justify-between text-slate-200">
                        <span>{t.title}</span>
                        <span className="text-slate-500">{t.status}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
