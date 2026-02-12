# Mission Control Nexus API

A Next.js 14 API for agent monitoring and Kanban ticket management with real-time status updates.

## Features

### 🎫 Kanban Ticket Management
- Create and manage tickets with status workflow: `Backlog → Assigned → InProgress → Review → Done`
- Filter tickets by status, priority, and assignee
- Auto-transition logic for valid state changes
- Pagination support

### 🤖 Agent Monitoring
- Real-time agent heartbeat tracking
- Agent status management (ONLINE, OFFLINE, IDLE, BUSY, ERROR, UNKNOWN)
- Health metrics and history
- Online/offline detection based on heartbeat recency

### 📊 System Monitoring
- Real-time system health status
- Agent and ticket statistics
- Recent error tracking
- API performance metrics

## Tech Stack

- **Framework**: Next.js 14
- **Database**: PostgreSQL (via Prisma ORM)
- **Database Providers**: Neon or Supabase
- **Language**: TypeScript
- **Deployment**: Vercel

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (Neon, Supabase, or local)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yash-jain-560/mission-control-nexus.git
cd mission-control-nexus
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
# Edit .env.local with your database URL
```

Example `.env.local`:
```
DATABASE_URL="postgresql://user:password@host:5432/nexus?schema=public"
NODE_ENV="development"
```

4. **Generate Prisma client**
```bash
npm run prisma:generate
```

5. **Push schema to database**
```bash
npm run prisma:push
```

6. **Start development server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Documentation

### Tickets Endpoints

#### Create Ticket
```
POST /api/tickets
Content-Type: application/json

{
  "title": "Fix login bug",
  "description": "Users unable to login with SSO",
  "priority": "URGENT",
  "reporterId": "user@example.com",
  "assigneeId": "dev@example.com",
  "dueDate": "2024-02-15",
  "tags": ["bug", "auth"]
}
```

Response: `201 Created`
```json
{
  "id": "ticket_123",
  "title": "Fix login bug",
  "status": "Backlog",
  "priority": "URGENT",
  "createdAt": "2024-02-12T11:00:00Z"
}
```

#### List Tickets
```
GET /api/tickets?status=InProgress&priority=HIGH&page=1&limit=20
```

Response: `200 OK`
```json
{
  "tickets": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Get Single Ticket
```
GET /api/tickets/:id
```

#### Update Ticket Status
```
PUT /api/tickets/:id
Content-Type: application/json

{
  "status": "InProgress",
  "assigneeId": "dev@example.com"
}
```

### Agent Endpoints

#### Send Heartbeat
```
POST /api/agents/:agentId/heartbeat
Content-Type: application/json

{
  "name": "Worker-1",
  "type": "worker",
  "status": "ONLINE",
  "health": {
    "status": "healthy",
    "lastCheck": "2024-02-12T11:00:00Z",
    "metrics": {
      "uptime": 3600,
      "memoryUsage": 256,
      "cpuUsage": 15.5,
      "taskQueueLength": 5,
      "responseTime": 120,
      "errorRate": 0.1
    }
  },
  "metadata": {
    "version": "1.0.0",
    "location": "US-EAST-1"
  }
}
```

Response: `200 OK`

#### List Agents
```
GET /api/agents?status=ONLINE&type=worker&page=1&limit=20
```

Response:
```json
{
  "agents": [...],
  "pagination": {...},
  "summary": {
    "total": 10,
    "online": 8,
    "offline": 2
  }
}
```

#### Get Agent Status
```
GET /api/agents/:agentId/status
```

Response:
```json
{
  "agent": {
    "agentId": "agent_123",
    "name": "Worker-1",
    "status": "ONLINE",
    "lastHeartbeat": "2024-02-12T11:05:00Z"
  },
  "healthStatus": "online",
  "isOnline": true,
  "lastHeartbeatAgo": "5s",
  "recentHeartbeats": [...],
  "recentHistory": [...]
}
```

### Monitoring Endpoints

#### System Health
```
GET /api/monitor/status
```

Response:
```json
{
  "timestamp": "2024-02-12T11:00:00Z",
  "status": "healthy",
  "agents": {
    "total": 10,
    "online": 8,
    "offline": 2,
    "onlinePercentage": 80
  },
  "tickets": {
    "total": 150,
    "byStatus": {
      "Backlog": 50,
      "Assigned": 30,
      "InProgress": 40,
      "Review": 20,
      "Done": 10
    },
    "inProgress": 70,
    "completed": 10
  }
}
```

#### Health Check
```
GET /api/health
```

## Deployment

### Vercel Deployment

1. **Push to GitHub**
```bash
git add .
git commit -m "build: migrate to Next.js with Prisma"
git push origin main
```

2. **Connect to Vercel**
- Go to https://vercel.com/new
- Select your repository
- Import project
- Add environment variables:
  - `DATABASE_URL`: Your PostgreSQL connection string

3. **Deploy**
```bash
vercel --prod
```

### Database Setup (Neon)

1. Create a Neon account at https://console.neon.tech
2. Create a new project
3. Copy connection string
4. Set `DATABASE_URL` in Vercel environment variables
5. Run migrations via Vercel dashboard or:
```bash
npm run prisma:push
```

## Database Schema

### Ticket Table
- `id`: Unique identifier
- `title`: Ticket title
- `description`: Detailed description
- `status`: Current status (Backlog, Assigned, InProgress, Review, Done)
- `priority`: Ticket priority (LOW, MEDIUM, HIGH, URGENT, CRITICAL)
- `assigneeId`: Assigned user/agent
- `reporterId`: Who created the ticket
- `dueDate`: Due date
- `tags`: Array of tags
- `metadata`: Custom JSON metadata

### Agent Table
- `id`: Unique identifier
- `agentId`: Custom agent identifier
- `name`: Agent name
- `type`: Agent type (worker, coordinator, monitor, etc.)
- `status`: Current status
- `health`: Health metrics JSON
- `lastHeartbeat`: Last heartbeat timestamp
- `lastActive`: Last active timestamp
- `metadata`: Custom JSON metadata

## Testing

### Using cURL

```bash
# Create ticket
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Ticket","priority":"HIGH"}'

# List tickets
curl http://localhost:3000/api/tickets

# Send agent heartbeat
curl -X POST http://localhost:3000/api/agents/agent-1/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"ONLINE","health":{}}'

# Get agents
curl http://localhost:3000/api/agents

# System status
curl http://localhost:3000/api/monitor/status
```

## Kanban Workflow Rules

### Valid Status Transitions
- **Backlog** → Assigned, InProgress
- **Assigned** → InProgress, Backlog
- **InProgress** → Review, Assigned
- **Review** → Done, InProgress
- **Done** → Review

### Auto-Transitions
- Assigning a ticket auto-transitions from Backlog → Assigned
- Moving to InProgress requires previous assignment
- Review stage for QA before marking as Done

## Performance

- Response time target: <200ms p95 latency
- Supports pagination for large result sets
- Indexed database queries for optimal performance
- Real-time heartbeat processing

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Create a pull request

## License

MIT

## Author

Yash Jain

## Support

For issues and questions, please create an issue on GitHub.
