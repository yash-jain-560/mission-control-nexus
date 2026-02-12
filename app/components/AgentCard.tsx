'use client'

import { useMemo, useState } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { MODEL_PRICING } from '@/lib/cost-calculator'

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
  config?: {
    model?: string
    temperature?: number
    maxTokens?: number
    tools?: string[]
    [key: string]: any
  }
  health?: {
    status?: string
    metrics?: {
      uptime?: number
      memoryUsage?: number
      cpuUsage?: number
      responseTime?: number
      errorRate?: number
    }
    errors?: string[]
  }
}

interface AgentCardProps {
  agent: Agent
}

// Agent Configuration Modal
function AgentConfigModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const modelName = agent.config?.model || agent.model || 'unknown';
  const pricing = MODEL_PRICING[modelName] || { input: 0.01, output: 0.03 };
  
  const tools = agent.config?.tools || [];
  
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full max-h-[80vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Agent Configuration</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">×</button>
        </div>
        
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Basic Info</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Name:</span>
                <span className="text-white ml-2">{agent.name}</span>
              </div>
              <div>
                <span className="text-slate-500">Type:</span>
                <span className="text-white ml-2">{agent.type}</span>
              </div>
              <div>
                <span className="text-slate-500">ID:</span>
                <span className="text-slate-300 ml-2 font-mono text-xs">{agent.id}</span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>
                <span className={`ml-2 ${agent.isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                  {agent.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Model Configuration */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Model Configuration</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Model:</span>
                <span className="text-white font-mono">{modelName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Temperature:</span>
                <span className="text-white">{agent.config?.temperature ?? 0.7}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Max Tokens:</span>
                <span className="text-white">{agent.config?.maxTokens?.toLocaleString() || '4,096'}</span>
              </div>
            </div>
          </div>
          
          {/* Pricing Info */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Pricing</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Input Cost:</span>
                <span className="text-emerald-400">${pricing.input}/1K tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Output Cost:</span>
                <span className="text-blue-400">${pricing.output}/1K tokens</span>
              </div>
            </div>
          </div>
          
          {/* Tools */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Enabled Tools</h4>
            {tools.length === 0 ? (
              <p className="text-sm text-slate-500">No tools configured</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <span 
                    key={tool}
                    className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Raw Config */}
          {agent.config && Object.keys(agent.config).length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-2">Raw Configuration</h4>
              <pre className="text-xs text-slate-400 overflow-auto max-h-32 bg-slate-900 p-2 rounded">
                {JSON.stringify(agent.config, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// System Health Display Component
function SystemHealthDisplay({ health }: { health?: Agent['health'] }) {
  if (!health) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4">
        <p className="text-sm text-slate-500">No health data available</p>
      </div>
    );
  }
  
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-400';
      case 'degraded': return 'text-amber-400';
      case 'unhealthy': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };
  
  const metrics = health.metrics || {};
  
  return (
    <div className="space-y-3">
      {/* Health Status */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">Health Status</span>
        <span className={`text-sm font-medium ${getStatusColor(health.status)}`}>
          {health.status?.toUpperCase() || 'UNKNOWN'}
        </span>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.uptime !== undefined && (
          <div className="bg-slate-800/50 rounded p-2">
            <p className="text-xs text-slate-500">Uptime</p>
            <p className="text-sm text-white">{formatUptime(metrics.uptime)}</p>
          </div>
        )}
        {metrics.memoryUsage !== undefined && (
          <div className="bg-slate-800/50 rounded p-2">
            <p className="text-xs text-slate-500">Memory</p>
            <p className="text-sm text-white">{metrics.memoryUsage.toFixed(1)} MB</p>
          </div>
        )}
        {metrics.cpuUsage !== undefined && (
          <div className="bg-slate-800/50 rounded p-2">
            <p className="text-xs text-slate-500">CPU</p>
            <p className={`text-sm ${metrics.cpuUsage > 80 ? 'text-red-400' : 'text-white'}`}>
              {metrics.cpuUsage.toFixed(1)}%
            </p>
          </div>
        )}
        {metrics.responseTime !== undefined && (
          <div className="bg-slate-800/50 rounded p-2">
            <p className="text-xs text-slate-500">Response Time</p>
            <p className={`text-sm ${metrics.responseTime > 1000 ? 'text-amber-400' : 'text-white'}`}>
              {metrics.responseTime.toFixed(0)} ms
            </p>
          </div>
        )}
        {metrics.errorRate !== undefined && (
          <div className="bg-slate-800/50 rounded p-2 col-span-2">
            <p className="text-xs text-slate-500">Error Rate</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${metrics.errorRate > 5 ? 'bg-red-500' : metrics.errorRate > 1 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, metrics.errorRate * 10)}%` }}
                />
              </div>
              <span className={`text-sm ${metrics.errorRate > 5 ? 'text-red-400' : metrics.errorRate > 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {metrics.errorRate.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Errors */}
      {health.errors && health.errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
          <p className="text-xs text-red-400 font-medium mb-1">Recent Errors</p>
          <ul className="space-y-1">
            {health.errors.slice(0, 3).map((error, i) => (
              <li key={i} className="text-xs text-red-300">• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function AgentCard({ agent }: AgentCardProps) {
  const [open, setOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'tickets' | 'activities'>('overview');

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
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/60">
        <div className="flex items-center justify-between mb-2">
          {/* Clickable title for config */}
          <button 
            onClick={() => setShowConfig(true)}
            className="font-semibold text-slate-100 hover:text-blue-400 transition-colors text-left"
          >
            {agent.name}
          </button>
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
        
        {/* Click to view details */}
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full text-xs text-center text-slate-500 hover:text-slate-300 py-1 border border-slate-800 hover:border-slate-600 rounded transition-colors"
        >
          View Details →
        </button>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <AgentConfigModal agent={agent} onClose={() => setShowConfig(false)} />
      )}

      {/* Detail Modal */}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfig(true)}
                  className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                >
                  ⚙️ Config
                </button>
                <button
                  className="text-slate-400 hover:text-white text-2xl"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-slate-800 mb-6">
              {(['overview', 'health', 'tickets', 'activities'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
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
              </div>
            )}
            
            {activeTab === 'health' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                  <p className="text-sm text-slate-400 mb-3 font-semibold">System Health Metrics</p>
                  <SystemHealthDisplay health={agent.health} />
                </div>
              </div>
            )}
            
            {activeTab === 'tickets' && (
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-3 font-semibold">Assigned Tickets ({agent.assignedTickets.length})</p>
                {agent.assignedTickets.length === 0 ? (
                  <p className="text-sm text-slate-500">No assigned tickets</p>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-auto">
                    {agent.assignedTickets.map((t) => (
                      <li key={t.id} className="p-3 bg-slate-800/50 rounded border border-slate-700 text-sm">
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
            )}
            
            {activeTab === 'activities' && (
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/60">
                <p className="text-sm text-slate-400 mb-3 font-semibold">Recent Activities</p>
                {agent.recentActivities.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activities</p>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-auto">
                    {agent.recentActivities.map((a) => (
                      <li
                        key={a.id}
                        className="text-xs text-slate-300 p-3 bg-slate-800/50 rounded border border-slate-700"
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
            )}
          </div>
        </div>
      )}
    </>
  )
}