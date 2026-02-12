# Mission Control Nexus

Multi-agent monitoring & Kanban ticket management platform. Built with Next.js, Prisma, and PostgreSQL.

## Features

✅ **Agent Registration & Monitoring**
- Real-time heartbeat tracking
- Agent status management (idle, working, thinking, executing)
- Token usage tracking
- Sub-agent relationship tracking

✅ **Kanban Ticket Management**
- Drag-and-drop state transitions: backlog → assigned → in_progress → review → done
- Automatic state validation (can't skip states)
- Ticket filtering by status and agent
- Priority levels: low, medium, high

✅ **Activity Logging**
- Automatic activity logs for all state changes
- Searchable activity feed
- Agent and ticket activity tracking

✅ **System Monitoring**
- Real-time system health check
- Agent statistics
- Ticket pipeline visibility
- Token usage metrics

## Tech Stack

- **Frontend:** Next.js 14 (App Router)
- **Backend:** Next.js API routes
- **Database:** PostgreSQL (Neon/Supabase recommended)
- **ORM:** Prisma
- **Language:** TypeScript

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local and add your DATABASE_URL

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev
```

Visit http://localhost:3000

### Database Setup

Using Neon (recommended for free tier):
```bash
# 1. Create account at https://neon.tech
# 2. Create a new project
# 3. Copy the connection string: postgresql://user:password@host/database
# 4. Add to .env.local: DATABASE_URL="your_connection_string"
```

## API Endpoints

### Agents

**List all agents**
```bash
GET /api/agents
```

**Register new agent**
```bash
POST /api/agents
Content-Type: application/json

{
  "name": "MyAgent",
  "status": "idle",
  "model": "gpt-4"
}
```

**Get agent status**
```bash
GET /api/agents/:agentId/status
```

**Send heartbeat**
```bash
POST /api/agents/:agentId/heartbeat
Content-Type: application/json

{
  "status": "working",
  "tokenUsage": 1500,
  "model": "gpt-4"
}
```

### Tickets

**List tickets**
```bash
GET /api/tickets?status=backlog&agentId=agent123
```

**Create ticket**
```bash
POST /api/tickets
Content-Type: application/json

{
  "title": "Implement feature X",
  "description": "Long description here",
  "priority": "high",
  "agentId": "agent123"
}
```

**Get ticket details**
```bash
GET /api/tickets/:ticketId
```

**Update ticket (status, agent, etc.)**
```bash
PATCH /api/tickets/:ticketId
Content-Type: application/json

{
  "status": "in_progress",
  "agentId": "agent123"
}
```

**Delete ticket**
```bash
DELETE /api/tickets/:ticketId
```

### Monitoring

**System health & stats**
```bash
GET /api/monitor/status
```

Response:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-02-12T11:30:00Z",
    "agents": {
      "total": 5,
      "active": 4,
      "activePercentage": 80
    },
    "tickets": {
      "total": 12,
      "byStatus": {
        "backlog": 3,
        "assigned": 2,
        "in_progress": 4,
        "review": 2,
        "done": 1
      }
    },
    "usage": {
      "totalTokens": 50000
    },
    "system": {
      "uptime": 3600,
      "memory": {...}
    }
  }
}
```

## State Transitions (Kanban)

Valid ticket state transitions:

- **backlog** → assigned, in_progress
- **assigned** → in_progress, backlog
- **in_progress** → review, assigned
- **review** → done, in_progress
- **done** → (no further transitions)

## Deployment to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "feat: Convert to Next.js with Kanban + Agent API"
git push origin main
```

### 2. Set up Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Or connect your GitHub repo directly at https://vercel.com/import

### 3. Environment Variables on Vercel

Add these in Vercel project settings:

```
DATABASE_URL = postgresql://...
NODE_ENV = production
```

### 4. Database Migration

Run migrations on Vercel:

```bash
# Option 1: Via Vercel CLI
vercel env pull
npm run prisma:migrate

# Option 2: In GitHub Actions (recommended)
# Create .github/workflows/deploy.yml with prisma:migrate step
```

## Development

### Generate Prisma Client
```bash
npm run prisma:generate
```

### View Database UI
```bash
npm run prisma:studio
```

### Build
```bash
npm run build
```

### Type Checking
```bash
npx tsc --noEmit
```

## Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── agents/           # Agent endpoints
│   │   ├── tickets/          # Ticket endpoints
│   │   └── monitor/          # System monitoring
│   ├── layout.tsx
│   └── page.tsx
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
└── package.json
```

## Next Steps

- [ ] Add WebSocket for real-time updates
- [ ] Build dashboard UI with React
- [ ] Add authentication/authorization
- [ ] Add activity timeline visualization
- [ ] Add batch operations for tickets
- [ ] Add agent SDK/npm package
- [ ] Performance monitoring & logging
- [ ] Rate limiting & caching

## Support

For issues or questions, open an issue on GitHub or check the docs at https://docs.openclaw.ai

## License

MIT
