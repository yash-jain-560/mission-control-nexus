'use client'

import { useMemo, useState } from 'react'
import { formatRelativeTime, statusTone } from '@/lib/utils'
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
  assignedTickets: Array<{ id: string; title: string; status: string; priority?: string }>
  recentActivities: Array<{ id: string; message: string; timestamp: string; tokens?: number }>
}

export function AgentCard({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false)
  const [activityDetail, setActivityDetail] = useState<any>(null)

  const tokenSeries = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        step: i + 1,
        tokens: Math.max(0, Math.round((agent.tokensUsed || 2000) * (0.35 + Math.random() * 0.75))),
      })),
    [agent.tokensUsed],
  )

  const getStatusColor = () => {
    return agent.isOnline
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      : 'bg-red-500/20 text-red-300 border-red-500/30'
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/60"
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-slate-100">{agent.name}</h4>
          <span className={`text-xs px-2 py-1 rounded border ${getStatusColor()}`}>
            {agent.isOnline ? 'Online' : 'Offline'}
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
                <p className="text-xs text-slate-400 mt-2">
                  Total: {(agent.tokensUsed || 0).toLocaleString()} tokens
                </p>
              </div>

              {/* Status & Health */}
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-3 font-semibold">Status & Health</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400">Current Status</p>
                    <p className={`text-sm font-semibold mt-1 ${agent.isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                      {agent.isOnline ? '✓ Online' : '✗ Offline'}
                    </p>
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
                          width: `${((agent.tokensUsed || 0) / (agent.tokensAvailable || 1000000)) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {Math.round(((agent.tokensUsed || 0) / (agent.tokensAvailable || 1000000)) * 100)}% used
                    </p>
                  </div>
                </div>
              </div>

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
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-3 font-semibold">Recent Activities</p>
                {agent.recentActivities.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activities</p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-auto">
                    {agent.recentActivities.map((a) => (
                      <li
                        key={a.id}
                        className="text-xs text-slate-300 p-2 bg-slate-800/50 rounded border border-slate-700 cursor-pointer hover:border-blue-500/50 transition-colors"
                        onClick={() => setActivityDetail(a)}
                      >
                        <div className="font-mono line-clamp-2">{a.message}</div>
                        <div className="flex justify-between items-center mt-1 text-slate-500">
                          <span>{formatRelativeTime(a.timestamp)}</span>
                          {a.tokens && <span>Tokens: {a.tokens}</span>}
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

      {activityDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center"
          onClick={() => setActivityDetail(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Activity Details</h4>
              <button className="text-slate-400 hover:text-white text-2xl" onClick={() => setActivityDetail(null)}>
                ×
              </button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-auto">
              <div>
                <p className="text-sm text-slate-400 mb-1">Message</p>
                <p className="text-sm text-slate-200 bg-slate-800/50 p-3 rounded font-mono">{activityDetail.message}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Timestamp</p>
                <p className="text-sm text-slate-200">{new Date(activityDetail.timestamp).toLocaleString()}</p>
              </div>
              {activityDetail.tokens && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Tokens Used</p>
                  <p className="text-sm text-slate-200">{activityDetail.tokens}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
