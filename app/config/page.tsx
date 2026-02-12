'use client'

import { useState, useEffect } from 'react'

interface AgentConfig {
  id: string
  name: string
  config: {
    model?: string
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
    timeout?: number
    toolPolicy?: {
      enabledTools: string[]
      disabledTools: string[]
      requireConfirmation: string[]
    }
    sessionSettings?: {
      maxDuration: number
      maxTurns: number
      idleTimeout: number
    }
  }
}

interface SystemConfig {
  database: { type: string; url: string }
  logging: { level: string; file?: string; maxSize: string; maxFiles: number }
  ui: { theme: string; autoRefresh: boolean; refreshInterval: number }
  gateway: { host: string; port: number; secure: boolean; apiKey: string }
  environment: { nodeEnv: string; vercelEnv: string }
  agents: Array<{ id: string; name: string; type: string; status: string; lastHeartbeat: string }>
}

export default function ConfigPage() {
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null)
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const [systemRes, agentsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/agents?limit=100'),
      ])

      if (systemRes.ok) {
        const systemData = await systemRes.json()
        setSystemConfig(systemData)
      }

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json()
        // Load detailed config for each agent
        const agentPromises = agentsData.agents.map(async (agent: any) => {
          const res = await fetch(`/api/config?agentId=${agent.id}`)
          if (res.ok) {
            return await res.json()
          }
          return null
        })
        const configs = (await Promise.all(agentPromises)).filter(Boolean)
        setAgentConfigs(configs)
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedAgent) return

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          config: selectedAgent.config,
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Configuration saved successfully' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save configuration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving configuration' })
    } finally {
      setSaving(false)
    }
  }

  const updateAgentConfig = (path: string, value: any) => {
    if (!selectedAgent) return

    setSelectedAgent({
      ...selectedAgent,
      config: {
        ...selectedAgent.config,
        [path]: value,
      },
    })
  }

  const updateNestedConfig = (section: string, path: string, value: any) => {
    if (!selectedAgent) return

    setSelectedAgent({
      ...selectedAgent,
      config: {
        ...selectedAgent.config,
        [section]: {
          ...((selectedAgent.config as any)[section] || {}),
          [path]: value,
        },
      },
    })
  }

  if (loading) {
    return (
      <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Configuration</h1>
        <p className="text-slate-400 mt-1">Manage agent settings and system configuration</p>
      </header>

      {/* System Overview */}
      {systemConfig && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">System Overview</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase">Environment</p>
              <p className="text-lg font-semibold text-white">{systemConfig.environment.nodeEnv}</p>
              <p className="text-xs text-slate-600">{systemConfig.environment.vercelEnv}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase">Database</p>
              <p className="text-lg font-semibold text-white">{systemConfig.database.type}</p>
              <p className="text-xs text-slate-600 truncate">{systemConfig.database.url}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase">Gateway</p>
              <p className="text-lg font-semibold text-white">{systemConfig.gateway.host}:{systemConfig.gateway.port}</p>
              <p className="text-xs text-slate-600">{systemConfig.gateway.secure ? 'Secure' : 'Insecure'}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase">Agents</p>
              <p className="text-lg font-semibold text-white">{systemConfig.agents.length}</p>
              <p className="text-xs text-slate-600">Registered agents</p>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Agent List */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Agents</h2>
          <div className="space-y-2">
            {agentConfigs.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedAgent?.id === agent.id
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <p className="text-sm font-medium text-white">{agent.name}</p>
                <p className="text-xs text-slate-500">{agent.id}</p>
                <p className="text-xs text-slate-600 mt-1">
                  Model: {agent.config.model || 'default'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Editor */}
        <div>
          {selectedAgent ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedAgent.name}</h2>
                  <p className="text-xs text-slate-500">{selectedAgent.id}</p>
                </div>
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              {/* Message */}
              {message && (
                <div className={`px-4 py-2 text-sm ${
                  message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Form */}
              <div className="p-4 space-y-6">
                {/* Model Settings */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Model Settings</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Model Name</label>
                      <input
                        type="text"
                        value={selectedAgent.config.model || ''}
                        onChange={(e) => updateAgentConfig('model', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                        placeholder="e.g., gpt-4, claude-3-opus"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max Tokens</label>
                      <input
                        type="number"
                        value={selectedAgent.config.maxTokens || 4000}
                        onChange={(e) => updateAgentConfig('maxTokens', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Temperature ({selectedAgent.config.temperature ?? 0.7})</label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={selectedAgent.config.temperature ?? 0.7}
                        onChange={(e) => updateAgentConfig('temperature', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Top P ({selectedAgent.config.topP ?? 1})</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={selectedAgent.config.topP ?? 1}
                        onChange={(e) => updateAgentConfig('topP', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </section>

                {/* Session Settings */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Session Settings</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max Duration (seconds)</label>
                      <input
                        type="number"
                        value={selectedAgent.config.sessionSettings?.maxDuration || 3600}
                        onChange={(e) => updateNestedConfig('sessionSettings', 'maxDuration', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max Turns</label>
                      <input
                        type="number"
                        value={selectedAgent.config.sessionSettings?.maxTurns || 50}
                        onChange={(e) => updateNestedConfig('sessionSettings', 'maxTurns', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Idle Timeout (seconds)</label>
                      <input
                        type="number"
                        value={selectedAgent.config.sessionSettings?.idleTimeout || 300}
                        onChange={(e) => updateNestedConfig('sessionSettings', 'idleTimeout', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Tool Policy */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Tool Policy</h3>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-sm text-slate-400">
                      Tool policies are configured per-agent. Enable/disable specific tools and set confirmation requirements.
                    </p>
                    <div className="mt-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(selectedAgent.config.toolPolicy?.enabledTools || []).includes('all')}
                          onChange={(e) => {
                            const enabled = e.target.checked
                            updateNestedConfig('toolPolicy', 'enabledTools', enabled ? ['all'] : [])
                          }}
                          className="rounded border-slate-600"
                        />
                        <span className="text-sm text-slate-300">Enable all tools</span>
                      </label>
                    </div>
                  </div>
                </section>

                {/* Environment Variables (Read-only) */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Environment</h3>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">NODE_ENV</span>
                        <span className="text-slate-300 font-mono">{systemConfig?.environment.nodeEnv}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gateway API Key</span>
                        <span className="text-slate-300 font-mono">{systemConfig?.gateway.apiKey || 'Not set'}</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
              <span className="text-6xl mb-4 block">⚙️</span>
              <h2 className="text-xl font-semibold text-white mb-2">Select an Agent</h2>
              <p className="text-slate-400">Choose an agent from the sidebar to configure its settings</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
