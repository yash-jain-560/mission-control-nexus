'use client'

import { useState } from 'react'

type DocSection = {
  id: string
  title: string
  content: React.ReactNode
}

const documentation: DocSection[] = [
  {
    id: 'overview',
    title: 'Platform Overview',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300">
          Mission Control Nexus is a real-time dashboard and control platform for AI agents.
          It provides comprehensive monitoring, task management, and activity tracking for your agent fleet.
        </p>
        <h3 className="text-lg font-semibold text-white mt-4">Key Features</h3>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><strong>Real-time Monitoring:</strong> Track agent status, health, and activities in real-time</li>
          <li><strong>Ticket Management:</strong> Kanban board for managing tasks and assignments</li>
          <li><strong>Token Tracking:</strong> Detailed input/output token usage with efficiency metrics</li>
          <li><strong>Activity Logging:</strong> Complete audit trail of all agent actions</li>
          <li><strong>Knowledge Base:</strong> Access to workspace documentation and memory files</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard Guide',
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Dashboard Widgets</h3>
        <div className="space-y-3">
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="font-medium text-white">Total Agents</p>
            <p className="text-sm text-slate-400">Shows the total number of registered agents in the system.</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="font-medium text-white">Tickets</p>
            <p className="text-sm text-slate-400">Total tickets with completion count in parentheses.</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="font-medium text-white">System Health</p>
            <p className="text-sm text-slate-400">Overall system status: Healthy (green), Degraded (yellow), or Unhealthy (red).</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="font-medium text-white">Total Tokens</p>
            <p className="text-sm text-slate-400">Cumulative token usage across all agents.</p>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mt-4">Agent Cards</h3>
        <p className="text-slate-300">Each agent card displays:</p>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li>Agent name and type</li>
          <li>Current status (Online/Offline)</li>
          <li>Token usage vs. available</li>
          <li>Last heartbeat timestamp</li>
          <li>Assigned ticket count</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'agents',
    title: 'Agent Status',
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Status Types</h3>
        <div className="grid gap-3">
          <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <div>
              <p className="font-medium text-white">IDLE</p>
              <p className="text-sm text-slate-400">Agent is online and waiting for a task. No activity for 30 seconds.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <div>
              <p className="font-medium text-white">THINKING</p>
              <p className="text-sm text-slate-400">Agent is reasoning or planning before taking action.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <div>
              <p className="font-medium text-white">WORKING</p>
              <p className="text-sm text-slate-400">Agent is actively processing a task or executing tools.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded">
            <span className="w-3 h-3 rounded-full bg-slate-500"></span>
            <div>
              <p className="font-medium text-white">OFFLINE</p>
              <p className="text-sm text-slate-400">No heartbeat received in 60 seconds.</p>
            </div>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mt-4">Status Transitions</h3>
        <p className="text-slate-300">
          Status changes are automatically tracked with timestamps and duration. 
          View the status history in each agent&apos;s detail modal to see how long agents spend in each state.
        </p>
      </div>
    ),
  },
  {
    id: 'activities',
    title: 'Activities & Tokens',
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Activity Types</h3>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><strong>agent_turn:</strong> Agent processing a user message</li>
          <li><strong>reasoning:</strong> Agent thinking/planning</li>
          <li><strong>tool_call:</strong> Tool execution</li>
          <li><strong>completion:</strong> Task completion</li>
          <li><strong>error:</strong> Error events</li>
          <li><strong>status_change:</strong> Agent status transitions</li>
        </ul>
        <h3 className="text-lg font-semibold text-white mt-4">Token Tracking</h3>
        <p className="text-slate-300">Each activity tracks:</p>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><strong>Input Tokens:</strong> Tokens sent to the model API</li>
          <li><strong>Output Tokens:</strong> Tokens received from the model API</li>
          <li><strong>Cache Hits:</strong> Number of cached token lookups</li>
          <li><strong>Duration:</strong> Processing time in milliseconds</li>
        </ul>
        <h3 className="text-lg font-semibold text-white mt-4">Efficiency Metrics</h3>
        <div className="bg-slate-800/50 p-3 rounded">
          <p className="text-sm text-slate-300">
            <strong>Cache Hit Rate:</strong> Percentage of tokens served from cache vs. API<br/>
            <strong>Tokens Per Second:</strong> Processing throughput metric
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'tickets',
    title: 'Ticket Lifecycle',
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Ticket States</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">Backlog</span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-300 text-sm">New tickets start here</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">Assigned</span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-300 text-sm">Assigned to an agent</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">In Progress</span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-300 text-sm">Actively being worked on</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">Review</span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-300 text-sm">Pending review/approval</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded">Done</span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-300 text-sm">Completed</span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mt-4">Priorities</h3>
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-slate-500/20 text-slate-300 text-xs rounded">LOW</span>
          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">MEDIUM</span>
          <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded">HIGH</span>
          <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded">CRITICAL</span>
        </div>
      </div>
    ),
  },
  {
    id: 'api',
    title: 'API Reference',
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Core Endpoints</h3>
        <div className="space-y-3 font-mono text-sm">
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">GET /api/agents</p>
            <p className="text-slate-400 mt-1">List all agents with optional filters (?status, ?type, ?detailed=true)</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">POST /api/agents</p>
            <p className="text-slate-400 mt-1">Register a new agent</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">GET /api/activities</p>
            <p className="text-slate-400 mt-1">List activities (?agentId, ?type, ?detailed=true)</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">POST /api/activities</p>
            <p className="text-slate-400 mt-1">Log a new activity with token tracking</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">GET /api/tickets</p>
            <p className="text-slate-400 mt-1">List tickets with optional filters</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">GET /api/tickets/[id]</p>
            <p className="text-slate-400 mt-1">Get detailed ticket info with history</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">GET /api/knowledge</p>
            <p className="text-slate-400 mt-1">List all documentation files</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">GET /api/config</p>
            <p className="text-slate-400 mt-1">Get system or agent configuration</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-blue-400">PATCH /api/config</p>
            <p className="text-slate-400 mt-1">Update agent configuration</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'sse',
    title: 'Real-time Updates',
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Server-Sent Events (SSE)</h3>
        <p className="text-slate-300">
          The dashboard uses SSE at <code className="bg-slate-800 px-1 rounded">/api/events</code> for real-time updates.
        </p>
        <h3 className="text-lg font-semibold text-white mt-4">Event Types</h3>
        <div className="space-y-2">
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="font-medium text-white">snapshot</p>
            <p className="text-sm text-slate-400">Full state update with agents, tickets, and activities</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="font-medium text-white">agent_status_change</p>
            <p className="text-sm text-slate-400">Single agent status update</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="font-medium text-white">activity_created</p>
            <p className="text-sm text-slate-400">New activity logged</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="font-medium text-white">ticket_updated</p>
            <p className="text-sm text-slate-400">Ticket state change</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Common Issues</h3>
        <div className="space-y-4">
          <div className="bg-slate-800/50 p-4 rounded">
            <p className="font-medium text-white">Agent shows as offline</p>
            <p className="text-sm text-slate-400 mt-1">
              Check that the agent is sending heartbeats at least every 60 seconds.
              Verify the agent can reach the API endpoint.
            </p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded">
            <p className="font-medium text-white">Activities not appearing</p>
            <p className="text-sm text-slate-400 mt-1">
              Ensure activities are being POSTed to /api/activities with a valid agentId.
              Check browser console for SSE connection errors.
            </p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded">
            <p className="font-medium text-white">Token tracking incorrect</p>
            <p className="text-sm text-slate-400 mt-1">
              Verify inputTokens and outputTokens are being sent with each activity.
              The system calculates total as input + output.
            </p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded">
            <p className="font-medium text-white">SSE connection drops</p>
            <p className="text-sm text-slate-400 mt-1">
              This is normal for idle connections. The UI automatically reconnects.
              Check network tab for /api/events requests.
            </p>
          </div>
        </div>
      </div>
    ),
  },
]

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview')

  const activeDoc = documentation.find(d => d.id === activeSection)

  return (
    <main className="p-4 md:p-6 bg-slate-950 min-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Documentation</h1>
        <p className="text-slate-400 mt-1">Platform guide, API reference, and troubleshooting</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Navigation */}
        <nav className="space-y-1">
          {documentation.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {section.title}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          {activeDoc && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">{activeDoc.title}</h2>
              <div className="prose prose-invert prose-slate max-w-none">
                {activeDoc.content}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
