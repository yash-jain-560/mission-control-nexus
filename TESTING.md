# API Testing Guide - Mission Control Nexus

This document provides comprehensive testing procedures for all API endpoints.

## Setup

### 1. Local Development
```bash
npm install
npm run prisma:generate
npm run prisma:push  # Creates tables in database
npm run dev
```

The API will be available at `http://localhost:3000`

### 2. Database Setup for Testing

#### Option A: Local PostgreSQL
```bash
# Start PostgreSQL
# macOS with Homebrew
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Verify connection
psql -U postgres -d mission_control_nexus

# Or set DATABASE_URL and push schema
DATABASE_URL="postgresql://postgres:password@localhost:5432/mission_control_nexus" npm run prisma:push
```

#### Option B: Neon Postgres (Free Tier)
```bash
# Set your Neon database URL
export DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?schema=public"
npm run prisma:push
```

## Testing Tools

### Using cURL
```bash
# Basic request
curl http://localhost:3000/api/health

# POST request
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'
```

### Using Postman
1. Import collection from `.postman_collection.json` (to be created)
2. Set base URL to `http://localhost:3000`
3. Run tests

### Using HTTPie
```bash
# Install
pip install httpie

# Usage
http GET localhost:3000/api/tickets
http POST localhost:3000/api/tickets title="Test"
```

## Endpoint Testing

### 1. Health Check

**GET /api/health**

```bash
curl http://localhost:3000/api/health
```

**Expected Response (200 OK)**:
```json
{
  "status": "ok",
  "timestamp": "2024-02-12T11:00:00Z",
  "uptime": 120.5
}
```

---

### 2. Ticket Management

#### Create Ticket
**POST /api/tickets**

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login bug",
    "description": "Users unable to login with SSO",
    "priority": "URGENT",
    "reporterId": "user@example.com",
    "assigneeId": "dev@example.com",
    "dueDate": "2024-02-20",
    "tags": ["bug", "auth"]
  }'
```

**Expected Response (201 Created)**:
```json
{
  "id": "clh7xyz...",
  "title": "Fix login bug",
  "description": "Users unable to login with SSO",
  "status": "Backlog",
  "priority": "URGENT",
  "reporterId": "user@example.com",
  "assigneeId": "dev@example.com",
  "createdAt": "2024-02-12T11:00:00Z",
  "updatedAt": "2024-02-12T11:00:00Z",
  "tags": ["bug", "auth"]
}
```

**Test Cases**:
1. ✅ Create ticket with all fields
2. ✅ Create ticket with only title
3. ❌ Create ticket without title (should fail)
4. ✅ Multiple tickets with different priorities

#### List Tickets
**GET /api/tickets**

```bash
# Get all tickets
curl http://localhost:3000/api/tickets

# Filter by status
curl http://localhost:3000/api/tickets?status=InProgress

# Filter by priority
curl http://localhost:3000/api/tickets?priority=HIGH

# Filter by assignee
curl http://localhost:3000/api/tickets?assigneeId=dev@example.com

# Pagination
curl http://localhost:3000/api/tickets?page=2&limit=10
```

**Expected Response (200 OK)**:
```json
{
  "tickets": [
    {
      "id": "...",
      "title": "...",
      "status": "Backlog",
      "priority": "HIGH",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Test Cases**:
1. ✅ Get all tickets
2. ✅ Filter by status (Backlog, Assigned, InProgress, Review, Done)
3. ✅ Filter by priority (LOW, MEDIUM, HIGH, URGENT, CRITICAL)
4. ✅ Filter by assignee
5. ✅ Combined filters
6. ✅ Pagination (page, limit)
7. ✅ Invalid page (should return empty)

#### Get Single Ticket
**GET /api/tickets/:id**

```bash
# Get ticket by ID
curl http://localhost:3000/api/tickets/clh7xyz...

# Non-existent ticket
curl http://localhost:3000/api/tickets/invalid-id
```

**Expected Responses**:

Success (200):
```json
{
  "id": "clh7xyz...",
  "title": "Fix login bug",
  "status": "Backlog",
  ...
}
```

Not Found (404):
```json
{
  "error": "Ticket not found"
}
```

#### Update Ticket Status
**PUT /api/tickets/:id**

```bash
# Transition: Backlog -> Assigned
curl -X PUT http://localhost:3000/api/tickets/clh7xyz... \
  -H "Content-Type: application/json" \
  -d '{"status": "Assigned", "assigneeId": "dev@example.com"}'

# Transition: Assigned -> InProgress
curl -X PUT http://localhost:3000/api/tickets/clh7xyz... \
  -H "Content-Type: application/json" \
  -d '{"status": "InProgress"}'

# Transition: InProgress -> Review
curl -X PUT http://localhost:3000/api/tickets/clh7xyz... \
  -H "Content-Type: application/json" \
  -d '{"status": "Review"}'

# Transition: Review -> Done
curl -X PUT http://localhost:3000/api/tickets/clh7xyz... \
  -H "Content-Type: application/json" \
  -d '{"status": "Done"}'
```

**Test Cases - Valid Transitions**:
1. ✅ Backlog → Assigned
2. ✅ Backlog → InProgress
3. ✅ Assigned → InProgress
4. ✅ Assigned → Backlog
5. ✅ InProgress → Review
6. ✅ InProgress → Assigned
7. ✅ Review → Done
8. ✅ Review → InProgress
9. ✅ Done → Review

**Test Cases - Invalid Transitions**:
1. ❌ Backlog → Review (skip state)
2. ❌ Backlog → Done (skip multiple states)
3. ❌ Done → Backlog (reverse to early state)
4. ❌ Review → Assigned (backwards)
5. ❌ Invalid status value

**Test Cases - Additional Updates**:
1. ✅ Update priority (LOW, MEDIUM, HIGH, URGENT, CRITICAL)
2. ✅ Update due date
3. ✅ Update tags
4. ✅ Update multiple fields at once

---

### 3. Agent Management

#### Send Heartbeat
**POST /api/agents/:agentId/heartbeat**

```bash
# Basic heartbeat
curl -X POST http://localhost:3000/api/agents/agent-001/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Worker-1",
    "type": "worker",
    "status": "ONLINE",
    "health": {
      "status": "healthy",
      "metrics": {
        "uptime": 3600,
        "memoryUsage": 256,
        "cpuUsage": 15.5,
        "taskQueueLength": 5,
        "responseTime": 120,
        "errorRate": 0.1
      }
    }
  }'

# Minimal heartbeat
curl -X POST http://localhost:3000/api/agents/agent-002/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status": "ONLINE"}'

# Error status
curl -X POST http://localhost:3000/api/agents/agent-003/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ERROR",
    "health": {"status": "unhealthy"}
  }'
```

**Expected Response (200 OK)**:
```json
{
  "message": "Heartbeat received",
  "agent": {
    "id": "...",
    "agentId": "agent-001",
    "name": "Worker-1",
    "type": "worker",
    "status": "ONLINE",
    ...
  },
  "timestamp": "2024-02-12T11:00:00Z"
}
```

**Test Cases**:
1. ✅ Send heartbeat for new agent (auto-creates)
2. ✅ Update existing agent heartbeat
3. ✅ Different statuses (ONLINE, OFFLINE, IDLE, BUSY, ERROR, UNKNOWN)
4. ✅ Include health metrics
5. ✅ Include metadata
6. ✅ Rapid successive heartbeats
7. ❌ Missing status (should fail)

#### List Agents
**GET /api/agents**

```bash
# Get all agents
curl http://localhost:3000/api/agents

# Filter by status
curl http://localhost:3000/api/agents?status=ONLINE

# Filter by type
curl http://localhost:3000/api/agents?type=worker

# Pagination
curl http://localhost:3000/api/agents?page=1&limit=20
```

**Expected Response (200 OK)**:
```json
{
  "agents": [
    {
      "id": "...",
      "agentId": "agent-001",
      "name": "Worker-1",
      "status": "ONLINE",
      "isOnline": true,
      "lastHeartbeatAgo": "5s",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "totalPages": 1
  },
  "summary": {
    "total": 10,
    "online": 8,
    "offline": 2
  }
}
```

**Test Cases**:
1. ✅ Get all agents
2. ✅ Filter by status
3. ✅ Filter by type
4. ✅ Combined filters
5. ✅ Pagination
6. ✅ Summary statistics

#### Get Agent Status
**GET /api/agents/:agentId/status**

```bash
# Get single agent with details
curl http://localhost:3000/api/agents/agent-001/status

# Non-existent agent
curl http://localhost:3000/api/agents/invalid-agent
```

**Expected Response (200 OK)**:
```json
{
  "agent": {
    "agentId": "agent-001",
    "name": "Worker-1",
    "status": "ONLINE",
    "lastHeartbeat": "2024-02-12T11:05:00Z",
    ...
  },
  "healthStatus": "online",
  "isOnline": true,
  "lastHeartbeatAgo": "5s",
  "recentHeartbeats": [...],
  "recentHistory": [...]
}
```

Not Found (404):
```json
{
  "error": "Agent not found"
}
```

**Test Cases**:
1. ✅ Get online agent details
2. ✅ Get offline agent (not updated in 30s)
3. ✅ Get recent heartbeats (last 10)
4. ✅ Get status history (last 20)
5. ❌ Non-existent agent (should fail)

---

### 4. System Monitoring

#### Get System Health
**GET /api/monitor/status**

```bash
# Get overall system status
curl http://localhost:3000/api/monitor/status
```

**Expected Response (200 OK)**:
```json
{
  "timestamp": "2024-02-12T11:00:00Z",
  "status": "healthy",
  "system": {
    "healthy": true,
    "degraded": false,
    "unhealthy": false
  },
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
  },
  "metrics": {
    "heartbeatsLast5Min": 42,
    "recentErrors": 0,
    "apiResponseTime": "45ms"
  }
}
```

**Test Cases**:
1. ✅ Get system health (healthy)
2. ✅ Health with multiple agents
3. ✅ Health with different ticket statuses
4. ✅ Error handling (degraded/unhealthy)
5. ✅ Metrics accuracy

---

## Load Testing

### Using Apache Bench
```bash
# 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:3000/api/health

# POST test
ab -n 100 -c 5 -p data.json -T application/json \
  http://localhost:3000/api/tickets
```

### Using k6
```bash
# Install k6
# Create test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function() {
  let res = http.get('http://localhost:3000/api/agents');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
EOF

# Run test
k6 run load-test.js
```

---

## Performance Benchmarks

Expected performance metrics:

| Endpoint | Method | P50 Latency | P95 Latency | P99 Latency |
|----------|--------|------------|------------|------------|
| /api/health | GET | <5ms | <10ms | <20ms |
| /api/tickets | GET | <50ms | <150ms | <300ms |
| /api/tickets | POST | <100ms | <200ms | <400ms |
| /api/tickets/:id | GET | <30ms | <100ms | <200ms |
| /api/agents | GET | <100ms | <250ms | <500ms |
| /api/monitor/status | GET | <150ms | <300ms | <500ms |

---

## Test Automation

### Postman Collections
Import the API into Postman for automated testing:
1. Export collection from workspace
2. Run tests in collection runner
3. Use environment variables for base URL

### GitHub Actions Tests
```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run prisma:push
      - run: npm run test
```

---

## Troubleshooting

### Connection Refused
- Verify database is running
- Check DATABASE_URL format
- Ensure server is started (`npm run dev`)

### Invalid JSON Responses
- Check Content-Type header
- Verify request body is valid JSON
- Check console for error details

### Timeout Errors
- Check database performance
- Monitor server resources
- Reduce query result size

### 404 Errors
- Verify endpoint URL
- Check parameter format
- Ensure resource exists

---

## Success Criteria

All endpoints must:
- ✅ Return correct HTTP status codes
- ✅ Return valid JSON responses
- ✅ Validate input data
- ✅ Handle errors gracefully
- ✅ Meet performance requirements
- ✅ Support all documented features
