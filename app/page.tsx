export default function Home() {
  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Mission Control Nexus API</h1>
      <p>Agent monitoring and ticket management API</p>
      
      <h2>Available Endpoints</h2>
      <ul>
        <li><strong>Tickets</strong>
          <ul>
            <li>POST /api/tickets - Create a new ticket</li>
            <li>GET /api/tickets - List all tickets (with filtering)</li>
            <li>PUT /api/tickets/:id - Update ticket status</li>
            <li>GET /api/tickets/:id - Get single ticket</li>
          </ul>
        </li>
        <li><strong>Agents</strong>
          <ul>
            <li>GET /api/agents - List all agents</li>
            <li>POST /api/agents/:agentId/heartbeat - Send agent heartbeat</li>
            <li>GET /api/agents/:agentId/status - Get agent status and details</li>
          </ul>
        </li>
        <li><strong>Monitoring</strong>
          <ul>
            <li>GET /api/monitor/status - Overall system health</li>
            <li>GET /api/health - Health check</li>
          </ul>
        </li>
      </ul>
      
      <h2>Ticket Status Workflow</h2>
      <p>Backlog → Assigned → InProgress → Review → Done</p>
      
      <h2>Getting Started</h2>
      <ol>
        <li>Set up your PostgreSQL database (Neon or Supabase)</li>
        <li>Configure DATABASE_URL in .env.local</li>
        <li>Run: npm run prisma:push</li>
        <li>Start the server: npm run dev</li>
      </ol>
    </main>
  )
}
