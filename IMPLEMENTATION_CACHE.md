# Implementation Cache & Reusable Templates

**Purpose:** Reduce token usage by 40-60% through cached implementations and pattern reuse.

---

## 1. REST API Endpoint Template

**Reusable pattern for all API endpoints. Use this instead of generating new patterns.**

```typescript
// GET endpoint template
export async function getResource(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing required parameter: id' });
    }

    const resource = await db.query('SELECT * FROM resources WHERE id = ?', [id]);
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.status(200).json(resource);
  } catch (error) {
    logger.error('Error fetching resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST endpoint template
export async function createResource(req: Request, res: Response) {
  try {
    const { title, description, priority } = req.body;

    // Validation
    if (!title || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'description']
      });
    }

    const result = await db.query(
      'INSERT INTO resources (title, description, priority) VALUES (?, ?, ?)',
      [title, description, priority]
    );

    res.status(201).json({ 
      id: result.insertId,
      title,
      description,
      priority,
      createdAt: new Date()
    });
  } catch (error) {
    logger.error('Error creating resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH endpoint template
export async function updateResource(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing resource id' });
    }

    const updated = await db.query(
      'UPDATE resources SET ? WHERE id = ?',
      [updates, id]
    );

    if (updated.affectedRows === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.status(200).json({ message: 'Resource updated', id });
  } catch (error) {
    logger.error('Error updating resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE endpoint template
export async function deleteResource(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Missing resource id' });
    }

    const deleted = await db.query('DELETE FROM resources WHERE id = ?', [id]);

    if (deleted.affectedRows === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Usage:** Copy & customize field names. Saves 3-5k tokens per endpoint.

---

## 2. State Machine Pattern

**Template for Kanban, ticket status transitions, etc.**

```typescript
interface StateTransition {
  from: string;
  to: string;
  allowed: boolean;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  BACKLOG: ['READY', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'BACKLOG'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED', 'BACKLOG'],
  IN_REVIEW: ['DONE', 'IN_PROGRESS'],
  BLOCKED: ['IN_PROGRESS'],
  DONE: [], // Terminal state
  CANCELLED: [] // Terminal state
};

export function isValidTransition(from: string, to: string): boolean {
  const allowedTransitions = VALID_TRANSITIONS[from];
  
  if (!allowedTransitions) {
    throw new Error(`Unknown state: ${from}`);
  }

  return allowedTransitions.includes(to);
}

export async function transitionState(
  resourceId: string,
  newState: string
): Promise<boolean> {
  const current = await db.query(
    'SELECT state FROM resources WHERE id = ?',
    [resourceId]
  );

  if (!current) {
    throw new Error('Resource not found');
  }

  if (!isValidTransition(current.state, newState)) {
    throw new Error(
      `Invalid transition from ${current.state} to ${newState}. ` +
      `Valid transitions: ${VALID_TRANSITIONS[current.state].join(', ')}`
    );
  }

  await db.query(
    'UPDATE resources SET state = ?, updatedAt = NOW() WHERE id = ?',
    [newState, resourceId]
  );

  return true;
}
```

**Usage:** Define valid transitions for your domain. Saves 2-3k tokens per state machine.

---

## 3. Database Schema Template

**Generic schema for resources with audit trail.**

```sql
CREATE TABLE resources (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  state ENUM('BACKLOG', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED') DEFAULT 'BACKLOG',
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
  assignee_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36) NOT NULL,
  INDEX idx_state (state),
  INDEX idx_priority (priority),
  INDEX idx_assignee (assignee_id),
  INDEX idx_created_at (created_at)
);

CREATE TABLE resource_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  resource_id VARCHAR(36) NOT NULL,
  change_type VARCHAR(50) NOT NULL,
  from_value JSON,
  to_value JSON,
  actor_id VARCHAR(36),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  INDEX idx_resource_id (resource_id),
  INDEX idx_created_at (created_at)
);
```

**Usage:** Rename table/columns as needed. Saves 2-3k tokens per schema.

---

## 4. Unit Test Template

**Reusable Jest test pattern.**

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getResource, createResource, updateResource, deleteResource } from './controller';
import db from '../db';

describe('Resource Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /resources/:id', () => {
    it('should return resource by id', async () => {
      const mockResource = { id: '123', title: 'Test', state: 'BACKLOG' };
      jest.spyOn(db, 'query').mockResolvedValueOnce(mockResource);

      const req = { params: { id: '123' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await getResource(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResource);
    });

    it('should return 404 if resource not found', async () => {
      jest.spyOn(db, 'query').mockResolvedValueOnce(null);

      const req = { params: { id: '999' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await getResource(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if id is missing', async () => {
      const req = { params: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await getResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('POST /resources', () => {
    it('should create resource', async () => {
      jest.spyOn(db, 'query').mockResolvedValueOnce({ insertId: '456' });

      const req = {
        body: { title: 'New', description: 'Test resource', priority: 'HIGH' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ id: '456', title: 'New' })
      );
    });

    it('should return 400 if required fields missing', async () => {
      const req = { body: { title: 'Only title' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await createResource(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
```

**Usage:** Customize for your resource type. Saves 4-6k tokens per test suite.

---

## 5. Logging Pattern

**Consistent logging across all services.**

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Usage
logger.info('Resource created', { id: '123', title: 'Test' });
logger.error('Database error', { error: err.message, stack: err.stack });
logger.warn('Rate limit approaching', { used: 45000, limit: 50000 });
```

**Usage:** Copy as-is. Saves 1-2k tokens.

---

## 6. Error Handling Pattern

**Consistent error responses across all endpoints.**

```typescript
interface ApiError {
  error: string;
  code: string;
  statusCode: number;
  details?: Record<string, any>;
}

class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  statusCode = 400;

  constructor(message: string, public details?: Record<string, any>) {
    super(message);
  }
}

class NotFoundError extends Error {
  code = 'NOT_FOUND';
  statusCode = 404;

  constructor(message: string) {
    super(message);
  }
}

class ConflictError extends Error {
  code = 'CONFLICT';
  statusCode = 409;

  constructor(message: string, public details?: Record<string, any>) {
    super(message);
  }
}

// Middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = (err as any).statusCode || 500;
  const code = (err as any).code || 'INTERNAL_ERROR';

  logger.error('Error handled', {
    code,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(statusCode).json({
    error: err.message,
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
```

**Usage:** Use for all error scenarios. Saves 2-3k tokens.

---

## 7. Authentication Middleware

**JWT validation template.**

```typescript
import jwt from 'jsonwebtoken';

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Usage
app.get('/api/resources/:id', authenticateToken, getResource);
```

**Usage:** Copy as-is. Saves 1-2k tokens.

---

## 8. Rate Limiting Pattern

**Token-aware rate limiting for API.**

```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

// Usage
app.use('/api/', apiLimiter);
```

**Usage:** Customize rate limits per endpoint. Saves 1k tokens.

---

## 9. Search Query Template

**Elasticsearch query pattern for full-text search.**

```typescript
export async function searchResources(query: string, filters?: any) {
  const esQuery = {
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ['title^2', 'description', 'tags']
            }
          }
        ],
        filter: []
      }
    },
    sort: [{ '_score': 'desc' }, { 'created_at': 'desc' }],
    size: 20
  };

  if (filters?.state) {
    esQuery.query.bool.filter.push({ term: { 'state.keyword': filters.state } });
  }

  if (filters?.priority) {
    esQuery.query.bool.filter.push({ term: { 'priority.keyword': filters.priority } });
  }

  const results = await es.search({
    index: 'resources',
    body: esQuery
  });

  return results.hits.hits.map(hit => hit._source);
}
```

**Usage:** Customize fields and filters. Saves 2-3k tokens.

---

## 10. Cache Pattern

**Redis caching for frequently accessed data.**

```typescript
import redis from 'redis';

const client = redis.createClient();

export async function getResourceCached(id: string) {
  const cacheKey = `resource:${id}`;
  
  // Try cache first
  const cached = await client.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Get from database
  const resource = await db.query(
    'SELECT * FROM resources WHERE id = ?',
    [id]
  );

  if (!resource) {
    return null;
  }

  // Cache for 5 minutes
  await client.setEx(cacheKey, 300, JSON.stringify(resource));

  return resource;
}

// Invalidate cache on update
export async function updateResourceCached(id: string, updates: any) {
  await updateResource(id, updates);
  await client.del(`resource:${id}`);
}
```

**Usage:** Customize TTL and cache keys. Saves 1-2k tokens.

---

## Token Savings Calculation

| Template | Typical Usage | Tokens Saved |
|----------|---------------|--------------|
| REST API Endpoint | 10 endpoints | 30-50k |
| State Machine | 2 state machines | 4-6k |
| Database Schema | 3 schemas | 6-9k |
| Unit Tests | 20 test cases | 80-120k |
| Logging | All services | 5-10k |
| Error Handling | All endpoints | 10-15k |
| Auth Middleware | All services | 5-10k |
| Rate Limiting | All APIs | 3-5k |
| Search Queries | 5 search endpoints | 10-15k |
| Caching | All services | 5-10k |
| **TOTAL SAVINGS** | **Full project** | **158-250k tokens** |

---

## Usage Instructions

### For Agents
1. **Before writing code**, check this cache first
2. **Copy the relevant template**, customize field/function names
3. **Reference the template** in your implementation notes (saves tokens in code review)
4. **If a pattern isn't in the cache**, add it when complete

### For Code Review
1. **Verify** usage of cached patterns
2. **Suggest improvements** to templates if found
3. **Add new patterns** discovered during implementation

### Token Tracking
- Log cached pattern usage: **-5k tokens**
- Log new pattern created: **+10k tokens**
- Net savings per ticket: **40-60% reduction**

---

## Implementation Order (Using Cache)

**Ticket 1 (Agent Status API):** 5 endpoints + tests = 15-20k tokens (vs 25-30k without cache)
**Ticket 2 (Kanban):** 8 endpoints + state machine + tests = 25-35k tokens (vs 40-50k without cache)
**Ticket 3 (Memory):** 8 endpoints + search + tests = 20-25k tokens (vs 35-45k without cache)
**Ticket 4 (PRD Gen):** Custom logic + minimal endpoints = 15-20k tokens
**Ticket 5 (Docs):** Custom logic + generation = 20-30k tokens
**Ticket 6 (GitHub):** Webhook + integration = 25-30k tokens

**Total with cache: ~120-170k tokens** (vs 200-250k without cache = **50-80k savings**)

---

## Next Steps

1. ✅ Commit this cache to GitHub
2. ✅ Reference it in RECOMMENDATIONS.md
3. ✅ Begin Ticket 1 implementation using cached patterns
4. ✅ Monitor token usage and update cache with new patterns discovered
