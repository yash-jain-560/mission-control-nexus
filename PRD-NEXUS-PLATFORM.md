# Mission Control Nexus - Platform PRD

## Overview
A centralized multi-agent monitoring and control platform where ANY agent can connect, register, and watch their sub-agents in real-time. Real-time status updates, activity logging, and Kanban-style ticket management.

## Core Features

### 1. Agent Registration & Connection
- Agents register via API with unique token
- SDK provided (npm package) for easy integration
- Real-time WebSocket connection for status updates
- Automatic disconnection handling

### 2. Real-Time Status Monitoring
- Live status for each agent: thinking/working/executing/idle
- Sub-agent tree visualization
- Token usage tracking
- Model being used
- Last activity timestamp

### 3. Kanban Ticket Management
- Create/Read/Update/Delete tickets
- Drag-and-drop between columns: todo/in-progress/review/done
- Ticket history & changelog
- Agent assignment tracking

### 4. Activity Logger
- Real-time activity timeline
- Task execution logs
- Error tracking and debugging
- Searchable activity feed

### 5. Dashboard
- Agent status cards (online/offline/idle)
- Real-time metrics (tokens/cost/latency)
- Kanban board view
- Activity log with filtering
- Dark theme, professional UI

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TailwindCSS
- shadcn/ui components
- WebSocket client (socket.io-client)
- Real-time updates via WebSocket

### Backend
- Next.js API routes
- PostgreSQL (Neon or Supabase)
- Prisma ORM
- WebSocket (socket.io)
- JWT authentication

### Deployment
- Vercel (frontend + API)
- PostgreSQL on Neon/Supabase (free tier)
- Environment: production-ready

### SDK
- npm package (`@mission-control/nexus-sdk`)
- TypeScript
- Automatic reconnection
- Event-based architecture

## API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/agents/register (SDK endpoint)
```

### Agent Endpoints
```
GET /api/agents - list all agents
GET /api/agents/:id - agent details
GET /api/agents/:id/status - real-time status
GET /api/agents/:id/subagents - tree view
POST /api/agents/:id/heartbeat - status update
```

### Ticket Endpoints
```
GET /api/tickets - list tickets
POST /api/tickets - create ticket
PATCH /api/tickets/:id - update ticket
DELETE /api/tickets/:id - delete ticket
GET /api/tickets/:id/history - changelog
```

### Activity Endpoints
```
GET /api/activity - activity feed
POST /api/activity/log - log activity (SDK)
GET /api/activity/:agentId - agent-specific activity
```

### WebSocket Events
```
agent:connect - agent connects
agent:disconnect - agent disconnects
agent:status - status update
ticket:created/updated/deleted
activity:logged
```

## Database Schema

### Agents Table
- id (UUID, primary)
- name (string)
- token (JWT, unique)
- workspace (string, optional)
- model (string)
- status (enum: online/offline/idle)
- lastHeartbeat (timestamp)
- createdAt, updatedAt

### SubAgents Table
- id (UUID)
- parentAgentId (FK to Agents)
- name (string)
- status (enum)
- model (string)
- tokens_used (integer)
- lastHeartbeat (timestamp)

### Tickets Table
- id (UUID)
- title (string)
- description (text)
- status (enum: todo/in-progress/review/done)
- agentId (FK to Agents)
- assignedTo (string, optional)
- createdAt, updatedAt
- changedAt (for sorting)

### Activity Table
- id (UUID)
- agentId (FK to Agents)
- type (enum: thinking/working/executing/idle/error/success)
- message (text)
- metadata (JSON)
- createdAt (timestamp)
- searchable (indexed)

## Folder Structure

```
mission-control-nexus/
├── apps/
│   ├── platform/              # Next.js web app
│   │   ├── app/
│   │   │   ├── api/           # API routes
│   │   │   ├── dashboard/     # Dashboard pages
│   │   │   ├── agents/        # Agent pages
│   │   │   ├── tickets/       # Ticket pages
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── AgentCard.tsx
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── ActivityLog.tsx
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── db.ts          # Prisma client
│   │   │   ├── websocket.ts   # Socket.io setup
│   │   │   ├── auth.ts
│   │   │   └── ...
│   │   ├── package.json
│   │   └── vercel.json
│   │
│   └── sdk/                    # npm package
│       ├── src/
│       │   ├── client.ts       # Main SDK class
│       │   ├── types.ts
│       │   ├── events.ts
│       │   └── index.ts
│       ├── package.json
│       └── README.md
│
├── packages/
│   ├── database/              # Shared DB schemas
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   │
│   └── types/                 # Shared TypeScript types
│       ├── src/
│       │   ├── agent.ts
│       │   ├── ticket.ts
│       │   └── index.ts
│       └── package.json
│
├── docs/
│   ├── API.md
│   ├── SDK-SETUP.md
│   ├── DEPLOYMENT.md
│   └── ARCHITECTURE.md
│
└── package.json (monorepo root)
```

## Success Metrics

1. **Platform Stability**
   - 99.9% uptime
   - <200ms API response time
   - Real-time updates <500ms

2. **Agent Connectivity**
   - Support 100+ concurrent agents
   - Auto-reconnection on failure
   - Zero data loss

3. **User Experience**
   - Dashboard load <2s
   - Smooth real-time updates
   - Mobile-responsive UI

## Implementation Phases

### Phase 1: MVP (Week 1)
- Next.js scaffold
- PostgreSQL schema
- Agent registration API
- Basic dashboard
- WebSocket status updates

### Phase 2: Features (Week 2)
- Kanban board
- Activity logging
- Advanced filtering
- UI polish

### Phase 3: SDK & Deployment (Week 3)
- npm SDK package
- Integration examples
- Vercel deployment
- Documentation

### Phase 4: Scale & Optimize (Week 4)
- Performance tuning
- Load testing
- Advanced features
- Production hardening

## Environment Variables

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
JWT_SECRET=...
SOCKET_IO_ORIGIN=...
VERCEL_ENV=production
```

## Success Criteria

✅ Agents can register and connect via SDK
✅ Real-time status updates on dashboard
✅ Kanban board for ticket management
✅ Activity logging with search
✅ Professional UI (dark theme)
✅ Deployed to Vercel
✅ Ready for multi-agent ecosystem
