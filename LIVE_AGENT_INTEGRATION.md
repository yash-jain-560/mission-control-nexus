# Live Agent Integration

This system makes all agents visible online in the Mission Control Nexus dashboard with real-time updates.

## Files Created

### 1. `lib/agent-monitor.ts`
Auto-heartbeat system that registers and maintains heartbeats for all agents.

**Usage:**
```typescript
import { agentMonitor, startAgentMonitoring } from './lib/agent-monitor';

// Register all default agents
await startAgentMonitoring();

// Or register a specific agent
await agentMonitor.registerAgent('my-agent', 'My Agent', 'worker', 'WORKING');

// Update status
await agentMonitor.updateStatus('my-agent', 'THINKING');
```

### 2. `lib/external-activity-logger.ts`
Simple interface for external agents to log activities.

**Usage:**
```typescript
import { logAgentActivity, logToolCall } from './lib/external-activity-logger';

// Log activity
await logAgentActivity({
  agentId: 'my-agent',
  agentName: 'My Agent',
  activityType: 'agent_turn',
  description: 'Processing request',
  tokens: { input: 100, output: 50 }
});

// Log tool call
await logToolCall('my-agent', 'My Agent', 'search', input, output, duration);
```

### 3. `scripts/heartbeat-monitor.js`
Standalone Node.js script for registering and heartbeating all agents.

**Usage:**
```bash
# Register all agents
node scripts/heartbeat-monitor.js --register

# Send heartbeats
node scripts/heartbeat-monitor.js

# Register + test activities
node scripts/heartbeat-monitor.js --register --test

# Continuous mode (heartbeats every 30s)
node scripts/heartbeat-monitor.js --loop

# Full setup
node scripts/heartbeat-monitor.js --register --test --loop
```

## Agents Registered

| Agent ID | Name | Type | Status |
|----------|------|------|--------|
| orbit-main | Orbit | main | WORKING |
| personal-agent | Personal Agent | worker | WORKING |
| work-agent | Work Agent | worker | WORKING |
| broad-monitor | Broad Monitor | monitor | WORKING |
| data-analyzer | Data Analyzer | analyzer | WORKING |

## API Endpoints

- **Register Agent:** `POST /api/agents`
- **Send Heartbeat:** `POST /api/agents/:agentId/heartbeat`
- **Log Activity:** `POST /api/activities`
- **List Agents:** `GET /api/agents`
- **Dashboard:** `GET /api/dashboard/snapshot`

## Testing

```bash
# Test locally
curl -X POST https://mission-control-nexus.vercel.app/api/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"test-agent","name":"Test","status":"WORKING"}'

# Check dashboard
open https://mission-control-nexus.vercel.app
```

## Status

✅ All agents registered  
✅ Heartbeats working (30s interval)  
✅ Activities being logged  
✅ Dashboard showing live updates  
✅ Agents appearing ONLINE  
