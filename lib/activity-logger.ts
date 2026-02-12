/**
 * Activity Logger Module
 * Core logging functions for comprehensive activity tracking
 */

import { prisma } from './prisma';
import { calculateTokens, calculateTokenStats } from './token-counter';
import { calculateCost, calculateActivityCost, CostBreakdown } from './cost-calculator';

// Activity Types
export const ACTIVITY_TYPES = {
  // Ticket Operations
  CREATE_TICKET: 'create_ticket',
  UPDATE_TICKET: 'update_ticket',
  DELETE_TICKET: 'delete_ticket',
  ASSIGN_TICKET: 'assign_ticket',
  CLOSE_TICKET: 'close_ticket',
  
  // Agent Operations
  AGENT_STARTED: 'agent_started',
  AGENT_COMPLETED: 'agent_completed',
  AGENT_ERROR: 'agent_error',
  AGENT_TURN: 'agent_turn',
  AGENT_REASONING: 'agent_reasoning',
  
  // Tool Operations
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  
  // API Operations
  API_CALL: 'api_call',
  API_RESPONSE: 'api_response',
  
  // System Operations
  SYSTEM_EVENT: 'system_event',
  STATUS_CHANGE: 'status_change',
  HEARTBEAT: 'heartbeat',
} as const;

export type ActivityType = typeof ACTIVITY_TYPES[keyof typeof ACTIVITY_TYPES];

// Activity Data Interface
export interface ActivityData {
  id?: string;
  agentId: string;
  activityType: ActivityType | string;
  description: string;
  
  // Content
  inputPrompt?: string;
  output?: string;
  contentParts?: {
    request?: any;
    response?: any;
    headers?: any;
    metadata?: any;
  };
  
  // Tokens
  inputTokens?: number;
  outputTokens?: number;
  cacheHits?: number;
  
  // Tool/Action Details
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  apiEndpoint?: string;
  apiMethod?: string;
  apiStatusCode?: number;
  
  // Context
  ticketId?: string;
  parentActivityId?: string;
  duration?: number;
  
  // System
  sessionId?: string;
  requestId?: string;
  traceId?: string;
  modelName?: string;
  
  // Additional metadata
  metadata?: any;
}

// Logged Activity with calculated fields
export interface LoggedActivity extends ActivityData {
  id: string;
  timestamp: string;
  totalTokens: number;
  cost?: CostBreakdown;
}

// Activity Chain for tracking nested activities
const activityChain: Map<string, string> = new Map(); // traceId -> currentActivityId

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate trace ID for distributed tracing
 */
export function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate and fill in token counts
 */
function calculateActivityTokens(data: ActivityData): ActivityData {
  const updated = { ...data };
  
  // Calculate tokens if not provided
  if (updated.inputTokens === undefined && updated.inputPrompt) {
    updated.inputTokens = calculateTokens(updated.inputPrompt);
  }
  
  if (updated.outputTokens === undefined && updated.output) {
    updated.outputTokens = calculateTokens(updated.output);
  }
  
  // Ensure cache hits is set
  if (updated.cacheHits === undefined) {
    updated.cacheHits = 0;
  }
  
  return updated;
}

/**
 * Log a new activity
 */
export async function logActivity(data: ActivityData): Promise<LoggedActivity> {
  const activityId = data.id || generateId();
  const timestamp = new Date().toISOString();
  
  // Calculate tokens
  const withTokens = calculateActivityTokens(data);
  
  // Calculate total tokens
  const totalTokens = (withTokens.inputTokens || 0) + (withTokens.outputTokens || 0);
  
  // Calculate cost if model name is provided
  let cost: CostBreakdown | undefined;
  if (data.modelName && (withTokens.inputTokens || withTokens.outputTokens)) {
    cost = calculateCost(
      withTokens.inputTokens || 0,
      withTokens.outputTokens || 0,
      data.modelName
    );
  }
  
  // Build content parts if not provided
  const contentParts = withTokens.contentParts || {};
  if (!contentParts.request && withTokens.inputPrompt) {
    contentParts.request = { prompt: withTokens.inputPrompt };
  }
  if (!contentParts.response && withTokens.output) {
    contentParts.response = { output: withTokens.output };
  }
  
  // Determine parent activity from chain
  let parentActivityId = withTokens.parentActivityId;
  if (!parentActivityId && withTokens.traceId && activityChain.has(withTokens.traceId)) {
    parentActivityId = activityChain.get(withTokens.traceId);
  }
  
  // Build metadata with cost info
  const metadata = {
    ...withTokens.metadata,
    ...(cost && { cost }),
    apiEndpoint: withTokens.apiEndpoint,
    apiMethod: withTokens.apiMethod,
    apiStatusCode: withTokens.apiStatusCode,
  };
  
  try {
    // Create activity in database with all new fields
    const activity = await prisma.activity.create({
      data: {
        id: activityId,
        agentId: withTokens.agentId,
        activityType: withTokens.activityType,
        description: withTokens.description,
        inputPrompt: withTokens.inputPrompt,
        output: withTokens.output,
        contentParts,
        inputTokens: withTokens.inputTokens || 0,
        outputTokens: withTokens.outputTokens || 0,
        totalTokens,
        cacheHits: withTokens.cacheHits || 0,
        toolName: withTokens.toolName,
        toolInput: withTokens.toolInput,
        toolOutput: withTokens.toolOutput,
        apiEndpoint: withTokens.apiEndpoint,
        apiMethod: withTokens.apiMethod,
        apiStatusCode: withTokens.apiStatusCode,
        duration: withTokens.duration || 0,
        ticketId: withTokens.ticketId,
        parentActivityId,
        sessionId: withTokens.sessionId,
        requestId: withTokens.requestId,
        traceId: withTokens.traceId,
        modelName: withTokens.modelName,
        costInput: cost?.inputCost,
        costOutput: cost?.outputCost,
        costTotal: cost?.totalCost,
        metadata,
      },
    });
    
    // Update activity chain for trace tracking
    if (withTokens.traceId) {
      activityChain.set(withTokens.traceId, activityId);
    }
    
    // Update ticket token totals if ticketId is provided
    if (withTokens.ticketId && totalTokens > 0) {
      await prisma.ticket.update({
        where: { id: withTokens.ticketId },
        data: {
          totalInputTokens: { increment: withTokens.inputTokens || 0 },
          totalOutputTokens: { increment: withTokens.outputTokens || 0 },
        },
      });
    }
    
    // Update agent status based on activity type
    await updateAgentStatusFromActivity(withTokens.agentId, withTokens.activityType);
    
    return {
      ...withTokens,
      id: activityId,
      timestamp,
      totalTokens,
      cost,
    };
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
}

/**
 * Update an existing activity
 */
export async function updateActivity(
  activityId: string,
  updates: Partial<ActivityData>
): Promise<void> {
  try {
    const updateData: any = { ...updates };
    
    // Recalculate tokens if output updated
    if (updates.output && !updates.outputTokens) {
      updateData.outputTokens = calculateTokens(updates.output);
    }
    
    await prisma.activity.update({
      where: { id: activityId },
      data: updateData,
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    throw error;
  }
}

/**
 * Log activity with automatic timing
 */
export async function logActivityWithTiming<T>(
  data: Omit<ActivityData, 'duration'>,
  fn: () => Promise<T>
): Promise<{ result: T; activity: LoggedActivity }> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    const activity = await logActivity({
      ...data,
      duration,
    });
    
    return { result, activity };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error activity
    const activity = await logActivity({
      ...data,
      duration,
      activityType: ACTIVITY_TYPES.AGENT_ERROR,
      description: `Error: ${error instanceof Error ? error.message : String(error)}`,
      output: JSON.stringify({ error: String(error) }),
    });
    
    throw error;
  }
}

/**
 * Log API call activity
 */
export async function logApiCall(
  agentId: string,
  req: {
    url: string;
    method: string;
    body?: any;
    headers?: any;
  },
  res: {
    statusCode: number;
    body?: any;
  },
  duration: number,
  options?: {
    ticketId?: string;
    traceId?: string;
  }
): Promise<LoggedActivity> {
  const inputPrompt = JSON.stringify({
    url: req.url,
    method: req.method,
    body: req.body,
  });
  
  const output = JSON.stringify({
    statusCode: res.statusCode,
    body: res.body,
  });
  
  return logActivity({
    agentId,
    activityType: ACTIVITY_TYPES.API_CALL,
    description: `${req.method} ${req.url} → ${res.statusCode}`,
    inputPrompt,
    output,
    contentParts: {
      request: req,
      response: res,
      headers: req.headers,
    },
    apiEndpoint: req.url,
    apiMethod: req.method,
    apiStatusCode: res.statusCode,
    duration,
    ...options,
  });
}

/**
 * Log tool call activity
 */
export async function logToolCall(
  agentId: string,
  toolName: string,
  toolInput: any,
  toolOutput: any,
  duration: number,
  options?: {
    ticketId?: string;
    parentActivityId?: string;
    traceId?: string;
  }
): Promise<LoggedActivity> {
  return logActivity({
    agentId,
    activityType: ACTIVITY_TYPES.TOOL_CALL,
    description: `Tool: ${toolName}`,
    toolName,
    toolInput,
    toolOutput,
    inputPrompt: JSON.stringify(toolInput),
    output: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput),
    duration,
    ...options,
  });
}

/**
 * Log ticket operation
 */
export async function logTicketOperation(
  agentId: string,
  operation: 'create' | 'update' | 'delete' | 'assign' | 'close',
  ticketId: string,
  details: any,
  options?: {
    traceId?: string;
    inputTokens?: number;
    outputTokens?: number;
  }
): Promise<LoggedActivity> {
  const operationMap: Record<string, string> = {
    create: ACTIVITY_TYPES.CREATE_TICKET,
    update: ACTIVITY_TYPES.UPDATE_TICKET,
    delete: ACTIVITY_TYPES.DELETE_TICKET,
    assign: ACTIVITY_TYPES.ASSIGN_TICKET,
    close: ACTIVITY_TYPES.CLOSE_TICKET,
  };
  
  return logActivity({
    agentId,
    activityType: operationMap[operation],
    description: `Ticket ${operation}: ${ticketId}`,
    ticketId,
    inputPrompt: JSON.stringify(details),
    output: JSON.stringify({ success: true, ticketId, operation }),
    ...options,
  });
}

/**
 * Get activity chain for a trace
 */
export async function getActivityChain(
  traceId: string
): Promise<LoggedActivity[]> {
  // This would require storing traceId in the database
  // For now, return empty array - can be enhanced later
  return [];
}

/**
 * Helper function to update agent status based on activity type
 */
async function updateAgentStatusFromActivity(agentId: string, activityType: string) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { status: true, statusHistory: true, currentStatusSince: true },
    });

    if (!agent) return;

    let newStatus: string | null = null;
    let reason: string = '';

    // Determine new status based on activity type
    if (activityType === ACTIVITY_TYPES.AGENT_REASONING || 
        activityType === ACTIVITY_TYPES.AGENT_TURN) {
      newStatus = 'THINKING';
      reason = `Started ${activityType}`;
    } else if (activityType === ACTIVITY_TYPES.TOOL_CALL) {
      newStatus = 'WORKING';
      reason = 'Executing tool';
    } else if (activityType === ACTIVITY_TYPES.AGENT_COMPLETED) {
      newStatus = 'IDLE';
      reason = 'Task completed';
    } else if (activityType === ACTIVITY_TYPES.AGENT_ERROR) {
      newStatus = 'IDLE';
      reason = 'Error occurred';
    }

    if (!newStatus || agent.status === newStatus) return;

    // Calculate duration in previous status
    const now = new Date();
    const statusSince = new Date(agent.currentStatusSince);
    const durationMs = now.getTime() - statusSince.getTime();

    // Build updated status history
    const statusHistory = Array.isArray(agent.statusHistory) ? agent.statusHistory : [];
    const updatedHistory = [
      ...statusHistory,
      {
        status: agent.status,
        timestamp: statusSince.toISOString(),
        durationMs,
        reason: 'Status transition',
      },
    ].slice(-50); // Keep last 50 transitions

    // Update agent
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: newStatus,
        statusHistory: updatedHistory,
        currentStatusSince: now,
        lastActive: now,
      },
    });
  } catch (error) {
    console.error('Error updating agent status:', error);
  }
}

export default {
  ACTIVITY_TYPES,
  logActivity,
  updateActivity,
  logActivityWithTiming,
  logApiCall,
  logToolCall,
  logTicketOperation,
  generateTraceId,
  getActivityChain,
};