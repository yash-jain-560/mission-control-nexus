# Mission Control Nexus

A centralized command and control platform for managing, monitoring, and orchestrating autonomous AI agents with real-time status tracking, ticket lifecycle management, automated PRD generation, and comprehensive activity logging.

## Project Vision

Mission Control Nexus is designed to provide unified oversight and coordination for multiple AI agents (Main, Work, Personal) working on complex tasks. It centralizes assignment, oversight, progress tracking, and documentation generation to reduce manual decision-making and enable scalable, autonomous workflows.

## Key Features

- **Real-time Agent Status Monitoring:** Agents report their state (thinking, working, executing, idle) with heartbeat signals
- **Kanban Ticket Management:** Full lifecycle tracking (Backlog → Assigned → InProgress → Review → Done → Failed)
- **Automated Ticket Creation:** Tickets auto-generate when tasks fail or require review
- **Activity Logging:** Comprehensive, immutable logs of all agent actions and status changes
- **PRD Auto-Generation:** Product Requirements Documents generated from ticket activities
- **Documentation System:** Auto-generated docs for tickets, PRDs, and architectural decisions
- **Memory Persistence:** Durable logs linked to tickets for traceability and replay capability

## Project Structure

```
mission-control-nexus/
├── personal/                    # Personal agent workspace
│   ├── requirement-analysis.md  # Project requirements & flow
│   └── tickets.md              # Ticket definitions & lifecycle
├── src/                         # Source code (TBD)
│   ├── api/                    # REST API implementation
│   ├── models/                 # Data models (Agent, Task, Ticket, LogEntry)
│   ├── services/               # Business logic (orchestration, routing)
│   └── utils/                  # Utilities (logging, memory, helpers)
├── docs/                        # Generated documentation
│   ├── api-reference.md        # API endpoint documentation
│   ├── architecture.md         # System design and components
│   └── prd-templates/          # PRD templates for future tickets
├── tests/                       # Test suites
├── .github/workflows/           # GitHub Actions CI/CD
├── package.json                 # Node.js dependencies
├── README.md                    # This file
└── LICENSE                      # MIT License
```

## Development Flow

1. **Requirement Analysis** ✅ - Project vision and feature breakdown defined
2. **Ticket Creation** ✅ - 6 core tickets created with clear AC
3. **PRD Generation** ⏳ - Detailed PRDs being generated for each ticket
4. **Agent Assignment** ⏳ - PRDs assigned to Work (Codex) or Personal (Claude) agents
5. **Implementation** ⏳ - Agents implement assigned features
6. **Documentation** ⏳ - Auto-generated docs for completed features
7. **GitHub Push** ⏳ - Verified changes pushed to main branch

## Ticket Summary

| Ticket | Title | Priority | Assigned to | Status |
|--------|-------|----------|------------|--------|
| 1 | Agent Status API | High | Work | Backlog |
| 2 | Kanban Lifecycle | High | Work | Backlog |
| 3 | Memory & Logging | High | Personal | Backlog |
| 4 | PRD Generation | Medium | Personal | Backlog |
| 5 | Documentation | Medium | Personal | Backlog |
| 6 | GitHub CI/CD | Medium | Work | Backlog |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- GitHub CLI (gh)
- OpenClaw (agent orchestration)

### Installation
```bash
git clone https://github.com/yash-jain-560/mission-control-nexus.git
cd mission-control-nexus
npm install
```

### Running the System
```bash
npm start
```

### Running Tests
```bash
npm test
```

## API Overview

### Agent Management
- `POST /api/v1/agents` - Register a new agent
- `GET /api/v1/agents` - List all agents
- `POST /api/v1/agents/{agent_id}/heartbeat` - Agent heartbeat/status update

### Task & Ticket Management
- `POST /api/v1/tasks` - Create a task
- `GET /api/v1/tasks` - List tasks (with filtering)
- `PUT /api/v1/tasks/{task_id}` - Update task status
- `POST /api/v1/tickets` - Create ticket
- `GET /api/v1/tickets` - List tickets

### Monitoring
- `GET /api/v1/monitor/agents` - Real-time agent status
- `GET /api/v1/monitor/status` - System health

### Memory & Logging
- `POST /api/v1/memory` - Persist memory entry
- `GET /api/v1/memory` - Retrieve memory logs

See `docs/api-reference.md` for detailed API documentation.

## Multi-Agent Architecture

### Main Agent (Coordinator)
- Orchestrates work between Work and Personal agents
- Manages overall flow and integration
- Makes assignment decisions

### Work Agent (Codex CLI)
- Focused on CLI and coding tasks
- Implements API endpoints, controllers, and utilities
- Handles GitHub integration and CI/CD

### Personal Agent (Claude Opus)
- Advanced reasoning and complex analysis
- Generates PRDs, documentation, and reasoning artifacts
- Manages memory persistence logic and decision-making

## Monitoring & Heartbeat

The system includes a proactive heartbeat mechanism that:
- Scans for pending work every 5 minutes
- Checks agent status and Git repo sync
- Reports blockers and progress updates
- Keeps the team informed without manual intervention

## Memory & Logging

All agent activities, status changes, and decisions are logged with:
- Timestamps
- Source agent ID
- Associated task/ticket ID
- Detailed context and metadata

Memory logs can be replayed to reconstruct project state and audit history.

## Contributing

See `CONTRIBUTING.md` for guidelines on:
- Code standards
- Testing requirements
- PR submission process
- Agent integration guidelines

## License

MIT License - see LICENSE file for details.

## Support & Issues

For questions, issues, or feature requests, please open a GitHub issue or contact the project maintainers.

## Roadmap

### Phase 1 (Current)
- Core infrastructure (agent registration, task management, basic monitoring)

### Phase 2
- Advanced features (data aggregation, integration with external systems)

### Phase 3
- ML-driven optimization, advanced security, enterprise features

---

**Last Updated:** 2026-02-12  
**Repository:** https://github.com/yash-jain-560/mission-control-nexus  
**Lead Agents:** Work (Codex), Personal (Claude Opus)
