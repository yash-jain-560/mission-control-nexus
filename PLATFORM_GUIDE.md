# Mission Control Nexus - Platform Guide

## Overview

Mission Control Nexus is a real-time dashboard and control platform for AI agents. It provides comprehensive monitoring, task management, and activity tracking for your agent fleet.

## Table of Contents

1. [Dashboard](#dashboard)
2. [Agent Status System](#agent-status-system)
3. [Activity Tracking](#activity-tracking)
4. [Ticket Management](#ticket-management)
5. [Token Tracking](#token-tracking)
6. [Knowledge Base](#knowledge-base)
7. [Configuration](#configuration)
8. [API Reference](#api-reference)
9. [Real-time Updates](#real-time-updates)
10. [Troubleshooting](#troubleshooting)

---

## Dashboard

The dashboard is the main control center providing an overview of your entire agent fleet.

### Widgets

#### Total Agents
- Shows the total number of registered agents in the system
- Click on any agent card to see detailed information

#### Tickets
- Total tickets with completion count in parentheses
- Quick access to ticket management via the Tickets tab

#### System Health
- **Healthy** (green): All systems operational
- **Degraded** (yellow): Some agents experiencing issues
- **Unhealthy** (red): Critical system issues detected

#### Total Tokens
- Cumulative token usage across all agents
- Updated in real-time as agents log activities

### Agent Cards

Each agent card displays:
- **Name and Type**: Human-readable identifier and agent category
- **Status**: Current operational state (IDLE, THINKING, WORKING, OFFLINE)
- **Token Usage**: Current usage vs. available quota
- **Last Heartbeat**: Time since last ping
- **Ticket Count**: Number of assigned tickets

Click any card to view:
- Token usage trend chart
- Detailed status history
- Assigned tickets list
- Recent activities with token breakdown

---

## Agent Status System

### Status Types

| Status | Icon | Description | Transition Trigger |
|--------|------|-------------|-------------------|
| **IDLE** | ⏸️ | Agent online, waiting for task | No activity for 30 seconds |
| **THINKING** | 🧠 | Agent reasoning/planning | `agent_turn` or `reasoning` activity |
| **WORKING** | ⚡ | Agent processing/executing tools | `tool_call` activity |
| **OFFLINE** | 💤 | Agent disconnected | No heartbeat for 60 seconds |

### Status Transitions

```
OFFLINE → IDLE (on heartbeat)
IDLE → THINKING (on reasoning/agent_turn)
THINKING → WORKING (on tool_call)
WORKING → IDLE (after 30s inactivity)
ANY → OFFLINE (60s without heartbeat)
```

### Status Tracking

- **Time in Status**: Each status duration is tracked
- **History**: Last 50 status transitions stored
- **Average Times**: Calculated per status type

---

## Activity Tracking

### Activity Types

| Type | Description |
|------|-------------|
| `agent_turn` | Agent processing user message |
| `reasoning` | Agent thinking/planning phase |
| `tool_call` | Tool execution |
| `completion` | Task completion |
| `error` | Error event |
| `status_change` | Agent status transition |
| `ticket_created` | New ticket created |
| `ticket_updated` | Ticket modified |
| `system_event` | System-level event |

### Activity Data

Each activity logs:
- **ID**: Unique identifier
- **Agent ID**: Source agent
- **Type**: Activity classification
- **Description**: Human-readable summary
- **Timestamp**: When activity occurred
- **Duration**: Processing time (ms)
- **Token Usage**: Input/output breakdown
- **Content Parts**: Full request/response payload
- **Tool Data**: If applicable (name, input, output)
- **Ticket Link**: Associated ticket ID

---

## Token Tracking

### Token Fields

| Field | Description |
|-------|-------------|
| `inputTokens` | Tokens sent to model API |
| `outputTokens` | Tokens received from model API |
| `cacheHits` | Cached token lookups |
| `total` | Calculated: input + output |

### Efficiency Metrics

- **Cache Hit Rate**: `cacheHits / totalTokens * 100`
- **Tokens Per Second**: `totalTokens / duration * 1000`
- **Cost Estimation**: Based on model pricing

### Per-Ticket Tracking

Tickets accumulate token usage from all related activities:
- `totalInputTokens`: Sum of all input tokens
- `totalOutputTokens`: Sum of all output tokens
- Activity breakdown shows contribution per activity

---

## Ticket Management

### Ticket States

```
Backlog → Assigned → InProgress → Review → Done
```

| State | Description |
|-------|-------------|
| **Backlog** | New ticket, not yet assigned |
| **Assigned** | Assigned to an agent |
| **InProgress** | Actively being worked on |
| **Review** | Pending review/approval |
| **Done** | Completed |

### Priorities

| Priority | Color | SLA Target |
|----------|-------|-----------|
| CRITICAL | 🔴 Red | Immediate |
| HIGH | 🟠 Orange | 24 hours |
| MEDIUM | 🔵 Blue | 72 hours |
| LOW | ⚪ Gray | 1 week |

### Ticket Details Modal

Click any ticket to view:
- Full description and metadata
- Assignment history
- Status change timeline
- Related activities
- Token usage breakdown
- Comments and activity log

---

## Knowledge Base

The Knowledge tab provides access to workspace documentation:

### Supported Files

- **SOUL.md**: Agent persona and personality
- **USER.md**: User profile and preferences
- **AGENTS.md**: Operating instructions
- **MEMORY.md**: Long-term memory storage
- **TOOLS.md**: Tool documentation
- **IDENTITY.md**: Agent identity configuration
- **BOOTSTRAP.md**: Initialization instructions

### Features

- **Search**: Full-text search across all files
- **Syntax Highlighting**: Markdown rendering
- **Last Modified**: Timestamps for freshness
- **File Size**: Storage monitoring

---

## Configuration

### Agent Configuration

Per-agent settings include:

#### Model Settings
- `model`: Model identifier (e.g., gpt-4, claude-3-opus)
- `temperature`: Sampling temperature (0-2)
- `maxTokens`: Maximum response tokens
- `topP`: Nucleus sampling parameter
- `frequencyPenalty`: Repetition penalty
- `presencePenalty`: Topic diversity penalty
- `timeout`: Request timeout (ms)

#### Tool Policy
- `enabledTools`: Allowed tools list
- `disabledTools`: Blocked tools list
- `requireConfirmation`: Tools needing approval

#### Session Settings
- `maxDuration`: Maximum session length (seconds)
- `maxTurns`: Maximum conversation turns
- `idleTimeout`: Idle timeout (seconds)

### System Configuration

View-only system settings:
- Database connection details
- Logging configuration
- Gateway settings
- Environment variables (masked)

---

## API Reference

### Agents

```http
GET /api/agents?status=&type=&detailed=true
POST /api/agents
PATCH /api/agents/:id
```

### Activities

```http
GET /api/activities?agentId=&type=&detailed=true
GET /api/activities/:id
POST /api/activities
```

### Tickets

```http
GET /api/tickets?status=&priority=&summary=true
GET /api/tickets/:id
POST /api/tickets
PUT /api/tickets/:id
DELETE /api/tickets/:id
```

### Knowledge

```http
GET /api/knowledge
GET /api/knowledge?file=SOUL.md
```

### Configuration

```http
GET /api/config
GET /api/config?agentId=agent-1
PATCH /api/config
```

### Events (SSE)

```http
GET /api/events
```

---

## Real-time Updates

### Server-Sent Events (SSE)

Endpoint: `/api/events`

### Event Types

```typescript
// Full state snapshot
type SnapshotEvent = {
  type: 'snapshot';
  timestamp: string;
  agents: AgentWithStats[];
  tickets: Ticket[];
  activities: Activity[];
  summary: DashboardSummary;
}

// Agent status change
type StatusChangeEvent = {
  type: 'agent_status_change';
  agentId: string;
  status: AgentStatus;
  timestamp: string;
}

// New activity
type ActivityEvent = {
  type: 'activity_created';
  activity: Activity;
}

// Ticket update
type TicketEvent = {
  type: 'ticket_updated';
  ticket: Ticket;
}
```

### Reconnection

The UI automatically reconnects if the SSE connection drops. This is normal for idle connections.

---

## Database Schema

### Core Tables

```sql
-- Agents
Agent {
  id: string @id
  name: string
  type: string
  status: string // IDLE, WORKING, THINKING, OFFLINE
  tokensAvailable: int
  tokensUsed: int
  health: json
  statusHistory: json
  currentStatusSince: datetime
  config: json
  lastHeartbeat: datetime
  lastActive: datetime
}

-- Activities
Activity {
  id: string @id
  agentId: string
  activityType: string
  description: string
  inputPrompt: string?
  output: string?
  toolName: string?
  toolInput: json?
  toolOutput: json?
  contentParts: json?
  inputTokens: int
  outputTokens: int
  cacheHits: int
  duration: int
  timestamp: datetime
  ticketId: string?
}

-- Tickets
Ticket {
  id: string @id
  title: string
  description: string?
  status: string
  priority: string
  assigneeId: string?
  reporterId: string
  totalInputTokens: int
  totalOutputTokens: int
  createdAt: datetime
  updatedAt: datetime
  dueDate: datetime?
  tags: string[]
}

-- Ticket History
TicketHistory {
  id: string @id
  ticketId: string
  changeType: string
  fromValue: json?
  toValue: json?
  changedBy: string
  timestamp: datetime
}
```

---

## Troubleshooting

### Agent Shows as Offline

1. Check heartbeat frequency (should be <60s)
2. Verify network connectivity to API
3. Check agent logs for errors

### Activities Not Appearing

1. Verify POST to `/api/activities`
2. Check `agentId` is valid
3. Check browser console for SSE errors

### Token Tracking Incorrect

1. Verify `inputTokens` and `outputTokens` in POST body
2. Check for integer overflow
3. Verify activities linked to correct agent

### SSE Connection Drops

- This is normal for idle connections
- UI auto-reconnects
- Check Network tab for `/api/events`

### Database Connection Issues

1. Verify `DATABASE_URL` environment variable
2. Check PostgreSQL is running
3. Verify migrations applied

---

## Development

### Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (with SQLite fallback)
- **Real-time**: Server-Sent Events (SSE)

### Environment Variables

```bash
# Required
DATABASE_URL="postgresql://..."

# Optional
NODE_ENV=development
LOG_LEVEL=info
GATEWAY_HOST=localhost
GATEWAY_PORT=8080
GATEWAY_API_KEY=your-key
```

### Build Commands

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Development server
npm run dev

# Production build
npm run build
npm start
```

---

## Changelog

### Phase 2 (Current)
- Enhanced token tracking (input/output split)
- Refined agent statuses (IDLE, THINKING, WORKING, OFFLINE)
- Knowledge tab for documentation
- Configuration panel
- Documentation tab
- Ticket detail modal with timeline
- Activity detail modal with payload view

### Phase 1
- Initial agent status tracking
- Basic activity logging
- Kanban ticket board
- Real-time dashboard
- Agent registration

---

*For more information, visit the Documentation tab in the application.*
