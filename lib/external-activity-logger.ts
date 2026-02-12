/**
 * External Activity Logger
 * Simple interface for external agents to log activities to Mission Control Nexus
 */

const MCN_API_URL = process.env.MCN_API_URL || 'https://mission-control-nexus.vercel.app/api';

export interface LogActivityData {
  agentId: string;
  agentName: string;
  activityType: string;
  description: string;
  input?: string;
  output?: string;
  toolName?: string;
  tokens?: { input: number; output: number };
  ticketId?: string;
  metadata?: any;
}

/**
 * Log an agent activity to Mission Control Nexus
 */
export async function logAgentActivity(data: LogActivityData): Promise<boolean> {
  try {
    const response = await fetch(`${MCN_API_URL}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: data.agentId,
        agentName: data.agentName,
        activityType: data.activityType,
        description: data.description,
        inputPrompt: data.input || '',
        output: data.output || '',
        inputTokens: data.tokens?.input || 0,
        outputTokens: data.tokens?.output || 0,
        toolName: data.toolName,
        ticketId: data.ticketId,
        metadata: data.metadata,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      console.log(`[MCN] Activity logged: ${data.activityType} - ${data.description}`);
      return true;
    } else {
      console.error(`[MCN] Activity log failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('[MCN] Activity log error:', error);
    return false;
  }
}

/**
 * Log a tool call activity
 */
export async function logToolCall(
  agentId: string,
  agentName: string,
  toolName: string,
  input: any,
  output: any,
  duration?: number
): Promise<boolean> {
  return logAgentActivity({
    agentId,
    agentName,
    activityType: 'tool_call',
    description: `Tool: ${toolName}`,
    input: JSON.stringify(input),
    output: JSON.stringify(output),
    toolName,
    metadata: { duration },
  });
}

/**
 * Log an API call activity
 */
export async function logApiCall(
  agentId: string,
  agentName: string,
  endpoint: string,
  method: string,
  statusCode: number,
  duration?: number
): Promise<boolean> {
  return logAgentActivity({
    agentId,
    agentName,
    activityType: 'api_call',
    description: `${method} ${endpoint} → ${statusCode}`,
    metadata: { endpoint, method, statusCode, duration },
  });
}

/**
 * Log agent status change
 */
export async function logStatusChange(
  agentId: string,
  agentName: string,
  fromStatus: string,
  toStatus: string
): Promise<boolean> {
  return logAgentActivity({
    agentId,
    agentName,
    activityType: 'status_change',
    description: `Status: ${fromStatus} → ${toStatus}`,
    metadata: { from: fromStatus, to: toStatus },
  });
}

export default {
  logAgentActivity,
  logToolCall,
  logApiCall,
  logStatusChange,
};
