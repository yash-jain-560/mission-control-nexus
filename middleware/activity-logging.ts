/**
 * Activity Logging Middleware
 * Wraps API handlers to automatically log all requests and responses
 * 
 * UPDATED:
 * - GET requests are now filtered out from activity logging (only POST/PUT/DELETE/PATCH are logged)
 * - Added system activity detection
 * - Added collapsible logging support
 */

import { NextRequest, NextResponse } from 'next/server';
import { logActivity, ACTIVITY_TYPES, generateTraceId, ActivityData } from '@/lib/activity-logger';
import { calculateTokens } from '@/lib/token-counter';
import { calculateCost } from '@/lib/cost-calculator';

// Store trace IDs for request correlation
const requestTraceMap = new WeakMap<NextRequest, string>();

// Methods that should be logged (skip GET/HEAD/OPTIONS)
const LOGGED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Check if a request method should be logged
 */
function shouldLogMethod(method: string): boolean {
  return LOGGED_METHODS.includes(method.toUpperCase());
}

/**
 * Check if activity is a system activity (vs user activity)
 */
function isSystemActivity(activityType: string, apiEndpoint?: string): boolean {
  const systemTypes = ['system_event', 'heartbeat', 'api_call'];
  const systemEndpoints = ['/api/health', '/api/events', '/api/monitor'];
  
  if (systemTypes.includes(activityType)) return true;
  if (apiEndpoint && systemEndpoints.some(endpoint => apiEndpoint.includes(endpoint))) return true;
  
  return false;
}

/**
 * Middleware options
 */
export interface ActivityLoggingOptions {
  /** Agent ID for the request (defaults to extracting from headers or 'system') */
  agentId?: string;
  /** Whether to include request/response body in logs */
  includeBody?: boolean;
  /** Whether to include headers in logs */
  includeHeaders?: boolean;
  /** Maximum body size to log (in bytes) */
  maxBodySize?: number;
  /** Ticket ID to associate with this request */
  ticketId?: string;
  /** Parent activity ID for nested logging */
  parentActivityId?: string;
  /** Custom activity type override */
  activityType?: string;
  /** Model name for cost calculation */
  modelName?: string;
  /** Force logging even for GET requests */
  forceLog?: boolean;
}

/**
 * Extract agent ID from request
 */
function extractAgentId(req: NextRequest, options?: ActivityLoggingOptions): string {
  if (options?.agentId) {
    return options.agentId;
  }
  
  // Try headers
  const headerAgentId = req.headers.get('x-agent-id');
  if (headerAgentId) {
    return headerAgentId;
  }
  
  // Try query params
  const url = new URL(req.url);
  const queryAgentId = url.searchParams.get('agentId');
  if (queryAgentId) {
    return queryAgentId;
  }
  
  return 'system';
}

/**
 * Extract trace ID from request or generate new one
 */
function getOrCreateTraceId(req: NextRequest): string {
  // Check if already stored
  if (requestTraceMap.has(req)) {
    return requestTraceMap.get(req)!;
  }
  
  // Try header
  const traceId = req.headers.get('x-trace-id');
  if (traceId) {
    requestTraceMap.set(req, traceId);
    return traceId;
  }
  
  // Generate new trace ID
  const newTraceId = generateTraceId();
  requestTraceMap.set(req, newTraceId);
  return newTraceId;
}

/**
 * Safely parse request body
 */
async function getRequestBody(req: NextRequest, maxSize: number = 10000): Promise<any> {
  try {
    // Clone the request to avoid consuming the original body
    const clonedReq = req.clone();
    const body = await clonedReq.text();
    
    if (body.length > maxSize) {
      return { truncated: true, size: body.length, preview: body.substring(0, maxSize) };
    }
    
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  } catch {
    return undefined;
  }
}

/**
 * Safely serialize response body
 */
function getResponseBody(body: any, maxSize: number = 10000): any {
  try {
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    
    if (serialized.length > maxSize) {
      return { truncated: true, size: serialized.length, preview: serialized.substring(0, maxSize) };
    }
    
    return body;
  } catch {
    return undefined;
  }
}

/**
 * Filter sensitive headers
 */
function filterHeaders(headers: Headers): Record<string, string> {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'api-key'];
  const filtered: Record<string, string> = {};
  
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaders.some(sh => lowerKey.includes(sh))) {
      filtered[key] = '[REDACTED]';
    } else {
      filtered[key] = value;
    }
  });
  
  return filtered;
}

/**
 * Wrap an API handler with activity logging
 * 
 * Usage:
 * ```typescript
 * export const GET = withActivityLogging(async (req) => {
 *   // Your handler code
 * }, { agentId: 'my-agent' });
 * ```
 * 
 * NOTE: By default, GET requests are NOT logged. Use forceLog: true to override.
 */
export function withActivityLogging<T extends (req: NextRequest, ...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options?: ActivityLoggingOptions
): T {
  return (async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const startTime = Date.now();
    const traceId = getOrCreateTraceId(req);
    const agentId = extractAgentId(req, options);
    const url = new URL(req.url);
    const method = req.method;
    
    // Skip logging for GET/HEAD/OPTIONS unless forceLog is true
    if (!shouldLogMethod(method) && !options?.forceLog) {
      return handler(req, ...args);
    }
    
    // Get request details
    const body = options?.includeBody !== false 
      ? await getRequestBody(req, options?.maxBodySize)
      : undefined;
    
    const headers = options?.includeHeaders 
      ? filterHeaders(req.headers)
      : undefined;
    
    const inputPrompt = JSON.stringify({
      url: req.url,
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body,
    });
    
    // Log the request start
    let activityId: string | undefined;
    
    try {
      // Execute the handler
      const response = await handler(req, ...args);
      const duration = Date.now() - startTime;
      
      // Extract response details
      const responseBody = await response.clone().json().catch(() => undefined);
      const output = JSON.stringify({
        statusCode: response.status,
        body: getResponseBody(responseBody, options?.maxBodySize),
      });
      
      // Calculate tokens
      const inputTokens = calculateTokens(inputPrompt);
      const outputTokens = calculateTokens(output);
      
      // Calculate cost if model specified
      let cost;
      if (options?.modelName) {
        cost = calculateCost(inputTokens, outputTokens, options.modelName);
      }
      
      // Determine if this is a system activity
      const activityType = options?.activityType || ACTIVITY_TYPES.API_CALL;
      const isSystem = isSystemActivity(activityType, url.pathname);
      
      // Log the completed activity
      const activity = await logActivity({
        agentId,
        activityType,
        description: `${req.method} ${url.pathname} → ${response.status}`,
        inputPrompt,
        output,
        contentParts: {
          request: {
            url: req.url,
            method: req.method,
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
            body,
            headers,
          },
          response: {
            statusCode: response.status,
            body: responseBody,
          },
        },
        inputTokens,
        outputTokens,
        apiEndpoint: url.pathname,
        apiMethod: req.method,
        apiStatusCode: response.status,
        duration,
        ticketId: options?.ticketId,
        parentActivityId: options?.parentActivityId,
        traceId,
        modelName: options?.modelName,
        metadata: {
          cost,
          queryParams: Object.fromEntries(url.searchParams),
          isSystemActivity: isSystem,
          collapsedByDefault: isSystem, // System activities are collapsed by default
        },
      });
      
      activityId = activity.id;
      
      // Add activity ID to response headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('x-activity-id', activity.id);
      responseHeaders.set('x-trace-id', traceId);
      
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log the error
      const errorOutput = JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      const inputTokens = calculateTokens(inputPrompt);
      const outputTokens = calculateTokens(errorOutput);
      
      const activityType = ACTIVITY_TYPES.AGENT_ERROR;
      const isSystem = isSystemActivity(activityType, url.pathname);
      
      await logActivity({
        agentId,
        activityType,
        description: `Error in ${req.method} ${url.pathname}: ${error instanceof Error ? error.message : String(error)}`,
        inputPrompt,
        output: errorOutput,
        contentParts: {
          request: {
            url: req.url,
            method: req.method,
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
            body,
          },
          response: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        inputTokens,
        outputTokens,
        apiEndpoint: url.pathname,
        apiMethod: req.method,
        apiStatusCode: 500,
        duration,
        ticketId: options?.ticketId,
        parentActivityId: options?.parentActivityId,
        traceId,
        modelName: options?.modelName,
        metadata: {
          isSystemActivity: isSystem,
          collapsedByDefault: isSystem,
        },
      });
      
      throw error;
    }
  }) as T;
}

/**
 * Higher-order function for logging specific operations within a handler
 */
export function createOperationLogger(
  agentId: string,
  defaultOptions?: Partial<ActivityData>
) {
  return async function logOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: Partial<ActivityData>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      await logActivity({
        agentId,
        activityType: ACTIVITY_TYPES.SYSTEM_EVENT,
        description: `Operation: ${operation}`,
        duration,
        metadata: {
          isSystemActivity: true,
          collapsedByDefault: true,
        },
        ...defaultOptions,
        ...options,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await logActivity({
        agentId,
        activityType: ACTIVITY_TYPES.AGENT_ERROR,
        description: `Operation failed: ${operation} - ${error instanceof Error ? error.message : String(error)}`,
        duration,
        output: JSON.stringify({ error: String(error) }),
        metadata: {
          isSystemActivity: true,
          collapsedByDefault: true,
        },
        ...defaultOptions,
        ...options,
      });
      
      throw error;
    }
  };
}

/**
 * Middleware for Next.js API routes
 * Usage in middleware.ts or route files
 */
export async function activityLoggingMiddleware(
  req: NextRequest,
  options?: ActivityLoggingOptions
): Promise<{ traceId: string; agentId: string; shouldLog: boolean }> {
  const traceId = getOrCreateTraceId(req);
  const agentId = extractAgentId(req, options);
  const shouldLog = shouldLogMethod(req.method) || options?.forceLog === true;
  
  return { traceId, agentId, shouldLog };
}

export default {
  withActivityLogging,
  createOperationLogger,
  activityLoggingMiddleware,
  shouldLogMethod,
  isSystemActivity,
  LOGGED_METHODS,
};