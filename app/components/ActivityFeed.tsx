'use client'

import { formatRelativeTime } from '@/lib/utils'

type ActivityItem = {
  id: string
  agentId?: string
  type: string
  message?: string
  description?: string
  timestamp: string
  tokens?: number
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <aside className="card p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">Live Activity</h3>
        <span className="text-xs text-slate-400">{items.length} events</span>
      </div>
      <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`h-2 w-2 rounded-full ${
                    item.type === 'agent_turn' || item.type === 'tool_call' ? 'bg-emerald-400' : item.type === 'completion' ? 'bg-blue-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs uppercase text-slate-400">{item.type}</span>
                <span className="ml-auto text-xs text-slate-500">{formatRelativeTime(item.timestamp)}</span>
              </div>
              <p className="text-sm text-slate-200">{item.message || item.description}</p>
              {item.tokens && <p className="text-xs text-slate-400 mt-1">Tokens: {item.tokens}</p>}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
