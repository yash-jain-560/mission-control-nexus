# Activity Logging System

A comprehensive activity logging system for Mission Control Nexus that captures every action, tracks tokens, and calculates costs across all agents and operations.

## Features

### 1. Automatic Activity Capture
Every action in the system is logged with full details:
- **Ticket Operations**: Create, update, assign, close
- **Agent Actions**: Turns, reasoning, tool calls, completions
- **API Calls**: All endpoints with request/response
- **Tool Usage**: Inputs, outputs, and execution time

### 2. Token Tracking
- Automatic token calculation for all inputs and outputs
- Support for tiktoken (accurate) and approximation fallback
- Cache hit tracking for efficiency metrics

### 3. Cost Calculation
- Per-model pricing for accurate cost tracking
- Support for OpenAI, Anthropic, Google, and custom models
- Budget tracking and alerts

### 4. Activity Chaining
- Parent-child relationships for nested activities
- Distributed tracing with trace IDs
- Complete lifecycle tracking from start to finish

### 5. Real-time Feed
- Live activity stream with auto-refresh
- Token usage and cost display
- Filterable by activity type

## Usage

### Basic Activity Logging

```typescript
import { logActivity, ACTIVITY_TYPES } from '@/lib/activity-logger';

const activity = await logActivity({
  agentId: 'my-agent',
  activityType: ACTIVITY_TYPES.AGENT_TURN,
  description: 'Processing user request',
  inputPrompt: 'User query here',
  output: 'Agent response here',
  modelName: 'gpt-4', // For cost calculation
  ticketId: 'ticket-123', // Optional
});
```

### API Route Logging (Automatic)

```typescript
import { withActivityLogging } from '@/middleware/activity-logging';

async function handler(req: NextRequest) {
  // Your handler code
  return NextResponse.json({ success: true });
}

export const GET = withActivityLogging(handler, {
  activityType: 'api_call',
  agentId: 'system',
});
```

### Tool Call Logging

```typescript
import { logToolCall } from '@/lib/activity-logger';

const activity = await logToolCall(
  'my-agent',
  'file_read',
  { path: '/file.txt' },
  { content: 'data' },
  150, // duration in ms
  { ticketId: 'ticket-123' }
);
```

### Ticket Operation Logging

```typescript
import { logTicketOperation } from '@/lib/activity-logger';

const activity = await logTicketOperation(
  'my-agent',
  'create', // or 'update', 'assign', 'close', 'delete'
  'ticket-123',
  { title: 'New Ticket', priority: 'HIGH' }
);
```

### Activity with Timing

```typescript
import { logActivityWithTiming } from '@/lib/activity-logger';

const { result, activity } = await logActivityWithTiming(
  {
    agentId: 'my-agent',
    activityType: ACTIVITY_TYPES.AGENT_TURN,
    description: 'Complex operation',
  },
  async () => {
    // Your async operation
    return await processData();
  }
);
```

### Trace ID for Distributed Tracing

```typescript
import { generateTraceId, logActivity } from '@/lib/activity-logger';

const traceId = generateTraceId();

// All activities with the same traceId are linked
await logActivity({
  agentId: 'agent-1',
  activityType: ACTIVITY_TYPES.AGENT_STARTED,
  traceId,
  // ...
});

await logActivity({
  agentId: 'agent-1',
  activityType: ACTIVITY_TYPES.TOOL_CALL,
  traceId,
  // ...
});
```

## Activity Types

### Ticket Operations
- `create_ticket` - New ticket created
- `update_ticket` - Ticket updated
- `delete_ticket` - Ticket deleted
- `assign_ticket` - Ticket assigned to agent
- `close_ticket` - Ticket closed/completed

### Agent Operations
- `agent_started` - Agent began work
- `agent_completed` - Agent finished work
- `agent_error` - Agent encountered error
- `agent_turn` - Agent processing turn
- `agent_reasoning` - Agent reasoning step

### Tool Operations
- `tool_call` - Tool invoked
- `tool_result` - Tool returned result

### API Operations
- `api_call` - API endpoint called
- `api_response` - API response sent

### System Operations
- `system_event` - General system event
- `status_change` - Status changed
- `heartbeat` - Agent heartbeat

## Token Calculation

### Methods

1. **tiktoken** (preferred) - Accurate token counting using OpenAI's tokenizer
2. **Approximation** - Character-based estimation (~4 chars/token)

### Usage

```typescript
import { calculateTokens, quickTokenEstimate } from '@/lib/token-counter';

// Accurate (requires tiktoken)
const tokens = calculateTokens('Your text here');

// Quick estimate (client-side)
const estimate = quickTokenEstimate('Your text here');
```

## Cost Calculation

### Supported Models

- OpenAI: GPT-4, GPT-4 Turbo, GPT-4o, GPT-4o-mini, GPT-3.5 Turbo
- Anthropic: Claude 3 Opus, Sonnet, Haiku
- Google: Gemini 1.5 Pro, Flash
- Custom: Moonshot, Local LLMs

### Usage

```typescript
import { calculateCost, formatCost } from '@/lib/cost-calculator';

const cost = calculateCost(1000, 500, 'gpt-4');
console.log(formatCost(cost.totalCost)); // "$0.0450"
```

### Budget Tracking

```typescript
import { CostTracker } from '@/lib/cost-calculator';

const tracker = new CostTracker(10.0); // $10 daily budget

tracker.track(activityCost);
console.log(tracker.getRemainingBudget()); // Remaining budget
console.log(tracker.isBudgetExceeded()); // Check if exceeded
```

## API Endpoints

### GET /api/activities
List activities with filtering:
- `agentId` - Filter by agent
- `type` - Filter by activity type
- `ticketId` - Filter by ticket
- `traceId` - Filter by trace
- `detailed=true` - Include full details

### POST /api/activities
Create a new activity log entry.

### GET /api/activities/[id]
Get detailed activity information:
- `includeChain=true` - Include parent/child activities

### PUT /api/activities/[id]
Update an activity (e.g., add output to started activity).

## Frontend Components

### ActivityFeed

```tsx
import { ActivityFeed } from '@/app/components/ActivityFeed';

<ActivityFeed 
  refreshInterval={5000}  // Auto-refresh every 5s
  showFilters={true}       // Show type filter
  maxItems={50}           // Max items to display
/>
```

### ActivityDetailModal

```tsx
import { ActivityDetailModal } from '@/app/components/ActivityDetailModal';

<ActivityDetailModal
  activityId={selectedId}
  onClose={() => setSelectedId(null)}
/>
```

## Database Schema

The `Activity` model includes:

```prisma
model Activity {
  id               String   @id @default(cuid())
  agentId          String
  activityType     String
  description      String
  
  // Content
  inputPrompt      String?
  output           String?
  contentParts     Json?    // { request, response, headers }
  
  // Tokens
  inputTokens      Int      @default(0)
  outputTokens     Int      @default(0)
  totalTokens      Int      @default(0)
  cacheHits        Int      @default(0)
  
  // API Details
  apiEndpoint      String?
  apiMethod        String?
  apiStatusCode    Int?
  
  // Context
  ticketId         String?
  parentActivityId String?
  sessionId        String?
  requestId        String?
  traceId          String?
  
  // Cost
  costInput        Float?
  costOutput       Float?
  costTotal        Float?
  modelName        String?
  
  // Metadata
  duration         Int      @default(0)
  timestamp        DateTime @default(now())
  metadata         Json     @default("{}")
  
  // Relations
  ticket           Ticket?  @relation(fields: [ticketId], references: [id])
  parent           Activity? @relation("ActivityChain", fields: [parentActivityId], references: [id])
  children         Activity[] @relation("ActivityChain")
}
```

## Testing

Run the activity logging tests:

```bash
npm run test:activities
```

This will verify:
- Basic activity logging
- Token calculation
- Cost calculation
- API call logging
- Tool call logging
- Ticket operation logging
- Activity chaining
- Database schema

## Migration

To apply the database migration:

```bash
# Generate migration SQL
npx prisma migrate dev --name add_activity_logging_enhancements

# Or apply directly
psql $DATABASE_URL -f prisma/migrations/add_activity_logging_enhancements.sql

# Regenerate Prisma client
npx prisma generate
```

## Best Practices

1. **Always include agentId** - Every activity should have an associated agent
2. **Use traceId for related activities** - Link activities that are part of the same flow
3. **Include ticketId when applicable** - Associate activities with tickets
4. **Set modelName for cost tracking** - Enable automatic cost calculation
5. **Use meaningful descriptions** - Make activities human-readable
6. **Log errors separately** - Use `AGENT_ERROR` type for failures
7. **Chain nested activities** - Use `parentActivityId` for sub-operations

## Troubleshooting

### Activities not appearing
- Check that `logActivity()` is being called
- Verify database connection
- Check API response for errors

### Token counts are 0
- Ensure `inputPrompt` or `output` is provided
- Check that text content is not empty

### Cost is not calculated
- Verify `modelName` is provided
- Check that model is in `MODEL_PRICING`

### Trace linking not working
- Ensure same `traceId` is used across activities
- Verify `includeChain=true` in API calls