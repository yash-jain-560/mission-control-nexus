# Mission Control Nexus - Tickets

## Ticket 1: Agent Status API & Real-Time Monitoring
- **Type:** Feature (Core)
- **Priority:** High
- **Assigned to:** Work Agent (Codex CLI)
- **Description:** Implement REST API endpoints for agent registration, heartbeat, and real-time status monitoring
- **Acceptance Criteria:**
  - POST /api/v1/agents (register agent)
  - POST /api/v1/agents/{agent_id}/heartbeat (agent status update)
  - GET /api/v1/monitor/agents (list all agents with current status)
  - GET /api/v1/monitor/status (overall system health)
- **Status:** Backlog

## Ticket 2: Kanban Ticket Lifecycle & Task Management
- **Type:** Feature (Core)
- **Priority:** High
- **Assigned to:** Work Agent (Codex CLI)
- **Description:** Implement task/ticket lifecycle management with states: Backlog → Assigned → InProgress → Review → Done → Failed
- **Acceptance Criteria:**
  - POST /api/v1/tasks (create task)
  - GET /api/v1/tasks (list tasks with filtering by status/agent)
  - PUT /api/v1/tasks/{task_id} (update task status)
  - Auto-transition logic between states
  - Ticket creation trigger on task failure
- **Status:** Backlog

## Ticket 3: Memory Persistence & Activity Logging
- **Type:** Feature (Core)
- **Priority:** High
- **Assigned to:** Personal Agent (Claude Opus)
- **Description:** Implement durable memory storage and comprehensive activity logging for traceability
- **Acceptance Criteria:**
  - Database schema for LogEntry, Agent, Task, Ticket models
  - POST /api/v1/memory (persist memory entry)
  - GET /api/v1/memory (retrieve memory logs)
  - Activity log on every state change with timestamp and context
  - Support for memory replay to reconstruct project state
- **Status:** Backlog

## Ticket 4: Automated PRD Generation
- **Type:** Feature
- **Priority:** Medium
- **Assigned to:** Personal Agent (Claude Opus)
- **Description:** Generate Product Requirements Documents automatically from ticket activities and requirements
- **Acceptance Criteria:**
  - POST /api/v1/prds (create PRD from ticket activity)
  - GET /api/v1/prds (list PRDs)
  - PRD template with Title, Problem, Goals, Success Metrics, Acceptance Criteria
  - Link PRDs to source tickets
- **Status:** Backlog

## Ticket 5: Documentation Generation & Artifacts
- **Type:** Feature
- **Priority:** Medium
- **Assigned to:** Personal Agent (Claude Opus)
- **Description:** Auto-generate documentation for tickets, PRDs, and architectural decisions
- **Acceptance Criteria:**
  - Create docs/ directory structure
  - Auto-generate README for each major component
  - Link documentation to tickets and PRDs
  - Versioning and change history tracking
- **Status:** Backlog

## Ticket 6: GitHub Integration & CI/CD Pipeline
- **Type:** Feature
- **Priority:** Medium
- **Assigned to:** Work Agent (Codex CLI)
- **Description:** Wire up GitHub Actions for automated testing, linting, and deployment
- **Acceptance Criteria:**
  - .github/workflows/ci.yml created
  - Automated git commit/push on ticket completion
  - Basic linting and test scaffolds
  - PR template and branch protection rules
- **Status:** Backlog
