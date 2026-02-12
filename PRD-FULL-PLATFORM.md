# Mission Control Nexus - Full Platform PRD

## Overview
A real-time agent monitoring & ticket management platform with a beautiful, functional UI. Live dashboard showing active agents, Kanban board for tickets, real-time status updates, and comprehensive activity logs.

## Core Requirements

### 1. Dashboard (Main Page)
**Components:**
- **Agent Cards** (grid layout)
  - Agent name & status (idle/working/thinking/executing)
  - Live indicator (green/red)
  - Token usage counter
  - Last heartbeat time (e.g., "2 minutes ago")
  - Model being used
  - Click to expand for details
  
- **Summary Stats** (top bar)
  - Total agents (active/offline)
  - Total tickets (by status)
  - System health status
  - Total tokens used

- **Agent Activity Feed** (right sidebar)
  - Real-time activity log
  - Agent status changes
  - Ticket updates
  - Sortable & filterable

### 2. Kanban Board (Tickets Page)
**Layout:**
- 5 columns: Backlog | Assigned | In Progress | Review | Done
- Drag-and-drop between columns
- Each card shows:
  - Ticket title
  - Priority (color-coded)
  - Assigned agent (avatar/name)
  - Tags
  - Created date

**Features:**
- Create new ticket (modal form)
- Edit ticket (inline or modal)
- Assign to agent
- Change priority
- Add notes/comments
- Delete ticket
- Real-time sync (updates when other users change)

### 3. Agent Details View
**Modal/Page showing:**
- Agent name & status (live indicator)
- Model & configuration
- Token usage (chart)
- Uptime
- Last heartbeat
- Sub-agents (tree view if hierarchical)
- Recent activities
- Assigned tickets

### 4. Real-Time Updates
- WebSocket or Server-Sent Events (SSE)
- Live agent status updates
- Live ticket status changes
- Live activity feed
- No page refresh needed

### 5. Visual Design
**Theme:**
- Dark mode (professional dashboard aesthetic)
- Accent colors: Blue, Green (active), Red (errors), Orange (warnings)
- Cards with subtle shadows
- Smooth animations
- Mobile responsive

**UI Components:**
- Status badges (colored pills)
- Agent avatars (initials in colored circle)
- Progress bars for token usage
- Live indicators (pulsing dot)
- Clean typography (sans-serif)

## Technical Spec

### Frontend Stack
- **Framework:** Next.js 14 (React)
- **Styling:** TailwindCSS + Shadcn UI components
- **Real-time:** Server-Sent Events (SSE) from API routes
- **State:** React hooks (useState, useEffect, useContext)
- **Forms:** React Hook Form + Zod validation

### Pages/Routes
```
/                      - Dashboard (agents + summary)
/tickets               - Kanban board
/agents/:id            - Agent details modal/page
/settings              - Configuration
```

### API Endpoints (Already Built)
- `GET /api/agents` - List agents
- `GET /api/agents/:id/status` - Agent details
- `POST /api/agents/:id/heartbeat` - Agent heartbeat
- `GET /api/tickets` - List tickets
- `POST /api/tickets` - Create ticket
- `PATCH /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket
- `GET /api/monitor/status` - System health

### New Endpoints Needed
- `GET /api/agents/:id/sse` - Server-Sent Events stream for live updates
- `GET /api/activity` - Activity feed (paginated)

## UI Mockup Structure

### Dashboard (/dashboard)
```
┌─────────────────────────────────────────────────────┐
│ Mission Control Nexus          🔄 Status: Healthy    │
├──────────────┬──────────────┬──────────────┬────────┤
│ 5 Agents     │ 12 Tickets   │ 28% Complete │ Tokens │
│ (3 active)   │ (4 in prog)  │              │ 45.2K  │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Agent 1  │  │ Agent 2  │  │ Agent 3  │          │
│  │ ● Active │  │ ● Idle   │  │ ● Offline│          │
│  │ gpt-4    │  │ gpt-3.5  │  │ claude   │          │
│  │ 12.3K    │  │ 8.1K     │  │ 2.4K     │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                       │
│                    | ACTIVITY FEED                  │
│                    | 2min ago: Agent1 working       │
│                    | 5min ago: Ticket#3 review→done │
│                    | 10min ago: Agent2 idle         │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Kanban Board (/tickets)
```
┌─────────────────────────────────────────────────────┐
│ Tickets Kanban Board    [+ Create Ticket]            │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Backlog  │ Assigned │ In Prog  │ Review   │  Done   │
│  (3)     │   (2)    │   (4)    │   (2)    │  (1)    │
├──────────┼──────────┼──────────┼──────────┼─────────┤
│ ┌──────┐ │┌──────┐ │┌──────┐ │         │        │
│ │Fix UI│ ││Impl  │ ││Test  │ │         │        │
│ │Hi    │ ││Feat1 │ ││API   │ │         │        │
│ │      │ ││Med   │ ││High  │ │         │        │
│ └──────┘ │└──────┘ │└──────┘ │         │        │
│          │         │          │         │        │
│ ┌──────┐ │         │┌──────┐ │         │        │
│ │Docs  │ │         ││Perf  │ │         │        │
│ │Med   │ │         ││Opt   │ │         │        │
│ │      │ │         ││Med   │ │         │        │
│ └──────┘ │         │└──────┘ │         │        │
└──────────┴──────────┴──────────┴──────────┴─────────┘
```

## Success Criteria

✅ **Functional:**
- Dashboard loads and displays live agent status
- Kanban board fully interactive (drag-drop works)
- Real-time updates without page refresh
- All CRUD operations for tickets work
- Agent details modal opens and shows data

✅ **Performance:**
- Page load < 2s
- Real-time updates < 500ms latency
- Smooth animations (60fps)

✅ **Design:**
- Professional dark theme
- Responsive (desktop first, mobile ok)
- Accessible (WCAG AA)
- Consistent branding

✅ **Deployment:**
- Live on Vercel
- Database connected
- Real-time working
- Zero console errors

## Timeline
- **Dashboard & Agent Cards:** 2-3 hours
- **Kanban Board:** 2-3 hours
- **Real-time updates (SSE):** 1-2 hours
- **Styling & Polish:** 1-2 hours
- **Testing & Deployment:** 1 hour

**Total:** ~8-10 hours

## Deliverables
1. React components for Dashboard, Kanban, Agent Details
2. TailwindCSS + Shadcn UI styling
3. Real-time SSE stream endpoint
4. Fully functional platform deployed on Vercel
5. All features working end-to-end
