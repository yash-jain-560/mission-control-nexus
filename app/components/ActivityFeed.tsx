'use client'

import { useState } from 'react'
import { formatRelativeTime } from '@/lib/utils'

type ActivityItem = {
  id: string
  agentId?: string
  type: string
  message?: string
  description?: string
  timestamp: string
  tokens?: number
  inputTokens?: number
  outputTokens?: number
  cacheHits?: number
  toolName?: string
  duration?: number
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null)

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'agent_turn':
      case 'reasoning':
        return '🧠'
      case 'tool_call':
        return '🛠️'
      case 'completion':
        return '✅'
      case 'error':
        return '❌'
      case 'status_change':
        return '🔄'
      default:
        return '📝'
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'agent_turn':
      case 'reasoning':
        return 'bg-amber-500'
      case 'tool_call':
        return 'bg-blue-500'
      case 'completion':
        return 'bg-emerald-500'
      case 'error':
        return 'bg-red-500'
      case 'status_change':
        return 'bg-purple-500'
      default:
        return 'bg-slate-500'
    }
  }

  // Calculate token efficiency
  const getTokenDisplay = (item: ActivityItem) => {
    if (!item.inputTokens && !item.outputTokens) {
      return item.tokens ? `${item.tokens.toLocaleString()} tokens` : null
    }
    const input = item.inputTokens || 0
    const output = item.outputTokens || 0
    const total = input + output
    return { input, output, total }
  }

  return (
    <>
      <aside className="bg-slate-900 border border-slate-800 rounded-lg p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide text-slate-200">Live Activity</h3>
          <span className="text-xs text-slate-500">{items.length} events</span>
        </div>
        <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet.</p>
          ) : (
            items.map((item) => {
              const tokenInfo = getTokenDisplay(item)
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedActivity(item)}
                  className="w-full text-left rounded-lg border border-slate-800 bg-slate-900/50 p-3 hover:border-blue-500/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{getActivityIcon(item.type)}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${getActivityColor(item.type)}`}
                    />
                    <span className="text-xs uppercase text-slate-400">{item.type}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 line-clamp-2">
                    {item.message || item.description}
                  </p>
                  {tokenInfo && typeof tokenInfo === 'object' ? (
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="text-slate-500">
                        <span className="text-emerald-400">↑{tokenInfo.input.toLocaleString()}</span>
                        {' '}
                        <span className="text-blue-400">↓{tokenInfo.output.toLocaleString()}</span>
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400">{tokenInfo.total.toLocaleString()} total</span>
                    </div>
                  ) : tokenInfo ? (
                    <p className="text-xs text-slate-400 mt-1">{tokenInfo}</p>
                  ) : null}
                  {item.toolName && (
                    <p className="text-xs text-blue-400 mt-1">Tool: {item.toolName}</p>
                  )}
                  {item.duration && item.duration > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Duration: {(item.duration / 1000).toFixed(2)}s
                    </p>
                  )}
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </>
  )
}

function ActivityDetailModal({ activity, onClose }: { activity: ActivityItem; onClose: () => void }) {
  const [fullDetails, setFullDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useState(() => {
    // Fetch full activity details
    fetch(`/api/activities/${activity.id}?detailed=true`)
      .then(res => res.json())
      .then(data => {
        setFullDetails(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  })

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Activity Details</h3>
            <p className="text-xs text-slate-500">ID: {activity.id}</p>
          </div>
          <button
            className="text-slate-400 hover:text-white text-2xl"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Type</p>
              <p className="text-sm text-white font-medium">{activity.type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Agent ID</p>
              <p className="text-sm text-white font-medium">{activity.agentId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Timestamp</p>
              <p className="text-sm text-white">{new Date(activity.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Duration</p>
              <p className="text-sm text-white">
                {activity.duration ? `${(activity.duration / 1000).toFixed(2)}s` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Token Breakdown */}
          {(activity.inputTokens || activity.outputTokens || activity.tokens) && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Token Usage</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Input</p>
                  <p className="text-lg font-semibold text-emerald-400">
                    {(activity.inputTokens || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Output</p>
                  <p className="text-lg font-semibold text-blue-400">
                    {(activity.outputTokens || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cache Hits</p>
                  <p className="text-lg font-semibold text-purple-400">
                    {(activity.cacheHits || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Total Tokens</span>
                  <span className="text-lg font-semibold text-white">
                    {((activity.inputTokens || 0) + (activity.outputTokens || 0) + (activity.tokens || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Description</p>
            <p className="text-sm text-slate-200 bg-slate-800/50 p-3 rounded">
              {activity.message || activity.description}
            </p>
          </div>

          {/* Tool Info */}
          {activity.toolName && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Tool</p>
              <p className="text-sm text-blue-400 font-mono">{activity.toolName}</p>
            </div>
          )}

          {/* Full Details (if loaded) */}
          {fullDetails && fullDetails.contentParts && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Content Parts</p>
              <div className="bg-slate-800/50 p-3 rounded max-h-48 overflow-auto">
                <pre className="text-xs text-slate-300">
                  {JSON.stringify(fullDetails.contentParts, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
