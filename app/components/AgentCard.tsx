'use client'

import { useMemo, useState } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

type Agent = {
  id: string
  name: string
  type: string
  status: string
  isOnline: boolean
  model?: string
  tokensUsed?: number
  tokensAvailable?: number
  lastHeartbeat: string
  timeInCurrentStatus?: number
  statusHistory?: Array<{ status: string; timestamp: string; durationMs: number }>
  assignedTickets: Array<{ id: string; title: string; status: string; priority?: string }>
  recentActivities: Array<{ id: string; message: string; timestamp: string; tokens?: number; inputTokens?: number; outputTokens?: number }>
  tokenStats?: {
    recent: number
    total: number
    input: number
    output: number
    cacheHits: number
  }
}

export function AgentCard({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false)

  const tokenSeries = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        step: i + 1,
        tokens: Math.max(0, Math.round((agent.tokensUsed || 2000) * (0.35 + Math.random() * 0.75))),
      })),
    [agent.tokensUsed]
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IDLE':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      case 'THINKING':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      case 'WORKING':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'OFFLINE':
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
      default:
        return agent.isOnline
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          : 'bg-red-500/20 text-red-300 border-red-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'IDLE':
        return '⏸️'
      case 'THINKING':
        return '🧠'
      case 'WORKING':
        return '⚡'
      case 'OFFLINE':
        return '💤'
      default:
        return agent.isOnline ? '🟢' : '🔴'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-300'
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-300'
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-300'
      default:
        return 'bg-slate-500/10 text-slate-300'
    }
  }

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`
    return `${Math.floor(ms / 3600000)}h`
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/60"
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-slate-100">{agent.name}</h4>
          <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(agent.status)}`}>
            {getStatusIcon(agent.status)} {agent.status}
          </span>
        </div>

        <div className="text-xs text-slate-400 mb-2">{agent.type}</div>

        <div className="space-y-2 text-sm text-slate-300">
          <p>
            Tokens:{' '}
            <span className="font-mono text-slate-100">
              {(agent.tokensUsed || 0).toLocaleString()} / {(agent.tokensAvailable || 1000000).toLocaleString()}
            </span>
          </p>
          <p className="text-slate-400 text-xs">Last heartbeat: {formatRelativeTime(agent.lastHeartbeat)}</p>
        </div>

        {agent.assignedTickets.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-400 mb-2">Tickets ({agent.assignedTickets.length})</p>
            <div className="space-y-1">
              {agent.assignedTickets.slice(0, 2).map((t) => (
                <div key={t.id} className="text-xs text-slate-300 truncate">
                  {t.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 md:p-8 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div
            className="bg-slate-900 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">{agent.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{agent.id} · {agent.type}</p>
              </div>
              <button
                className="text-slate-400 hover:text-white text-2xl"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Token Trend */}
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-3 font-semibold">Token Usage Trend</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tokenSeries}>
                      <XAxis dataKey="step" hide />
                      <Tooltip />
                      <Area type="monotone" dataKey="tokens" stroke="#3b82f6" fill="#1d4ed8" fillOpacity={0.35} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {agent.tokenStats && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-sm font-semibold text-white">{agent.tokenStats.total.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Recent</p>
                      <p className="text-sm font-semibold text-emerald-400">{agent.tokenStats.recent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Cache Hits</p>
                      <p className="text-sm font-semibold text-purple-400">{agent.tokenStats.cacheHits.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status & Health */}
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-3 font-semibold">Status & Health</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400">Current Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-sm font-semibold ${agent.isOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {getStatusIcon(agent.status)} {agent.status}
                      </span>
                      {agent.timeInCurrentStatus && (
                        <span className="text-xs text-slate-500">
                          for {formatDuration(agent.timeInCurrentStatus)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Last Heartbeat</p>
                    <p className="text-sm text-slate-200 mt-1">{formatRelativeTime(agent.lastHeartbeat)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Token Capacity</p>
                    <div className="mt-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${Math.min(((agent.tokensUsed || 0) / (agent.tokensAvailable || 1000000)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {Math.round(((agent.tokensUsed || 0) / (agent.tokensAvailable || 1000000)) * 100)}% used
                    </p>
                  </div>
                </div>
              </div>

              {/* Status History */}
              {agent.statusHistory && agent.statusHistory.length > 0 && (
                <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                  <p className="text-sm text-slate-400 mb-3 font-semibold">Recent Status History</p>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {agent.statusHistory.slice(-5).reverse().map((transition, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{transition.status}</span>
                        <span className="text-xs text-slate-500">
                          {formatDuration(transition.durationMs || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned Tickets */}
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-3 font-semibold">Assigned Tickets ({agent.assignedTickets.length})</p>
                {agent.assignedTickets.length === 0 ? (
                  <p className="text-sm text-slate-500">No assigned tickets</p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-auto">
                    {agent.assignedTickets.map((t) => (
                      <li key={t.id} className="p-2 bg-slate-800/50 rounded border border-slate-700 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-200 flex-1">{t.title}</span>
                          {t.priority && (
                            <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(t.priority)} whitespace-nowrap`}>
                              {t.priority}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Status: {t.status}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recent Activities */}
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60 md:col-span-2">
                <p className="text-sm text-slate-400 mb-3 font-semibold">Recent Activities</p>
                {agent.recentActivities.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activities</p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-auto">
                    {agent.recentActivities.map((a) => (
                      <li
                        key={a.id}
                        className="text-xs text-slate-300 p-2 bg-slate-800/50 rounded border border-slate-700"
                      >
                        <div className="font-mono line-clamp-2">{a.message}</div>
                        <div className="flex justify-between items-center mt-1 text-slate-500">
                          <span>{formatRelativeTime(a.timestamp)}</span>
                          {(a.tokens || a.inputTokens || a.outputTokens) && (
                            <span className="text-slate-400">
                              {a.inputTokens !== undefined && (
                                <span className="text-emerald-400">↑{a.inputTokens.toLocaleString()}</span>
                              )}
                              {' '}
                              {a.outputTokens !== undefined && (
                                <span className="text-blue-400">↓{a.outputTokens.toLocaleString()}</span>
                              )}
                              {a.tokens && a.tokens.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
