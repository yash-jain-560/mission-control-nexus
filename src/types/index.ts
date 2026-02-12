// Enhanced Types for Mission Control Nexus - Phase 2

// ============================================================================
// AGENT TYPES
// ============================================================================

export enum AgentStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  THINKING = 'THINKING',
  OFFLINE = 'OFFLINE'
}

export enum AgentType {
  WORKER = 'worker',
  COORDINATOR = 'coordinator',
  MONITOR = 'monitor',
  STORAGE = 'storage',
  API = 'api'
}

export interface AgentStatusTransition {
  status: AgentStatus;
  timestamp: string;
  durationMs?: number;
  reason?: string;
}

export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
  toolPolicy?: {
    enabledTools: string[];
    disabledTools: string[];
    requireConfirmation: string[];
  };
  sessionSettings?: {
    maxDuration: number;
    maxTurns: number;
    idleTimeout: number;
  };
}

export interface AgentHealthMetrics {
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  taskQueueLength: number;
  responseTime: number;
  errorRate: number;
}

export interface AgentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: string;
  metrics: AgentHealthMetrics;
  errors?: string[];
}

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  type: AgentType;
  tokensAvailable: number;
  tokensUsed: number;
  health: AgentHealth;
  statusHistory: AgentStatusTransition[];
  currentStatusSince: string;
  config: AgentConfig;
  lastHeartbeat: string;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface AgentWithStats extends Agent {
  isOnline: boolean;
  timeInCurrentStatus: number;
  averageStatusTimes: Record<AgentStatus, number>;
  recentActivities: Activity[];
  assignedTickets: Ticket[];
  tokenStats: {
    recent: number;
    total: number;
    input: number;
    output: number;
    cacheHits: number;
  };
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export enum ActivityType {
  AGENT_TURN = 'agent_turn',
  TOOL_CALL = 'tool_call',
  COMPLETION = 'completion',
  REASONING = 'reasoning',
  ERROR = 'error',
  WARNING = 'warning',
  STATUS_CHANGE = 'status_change',
  TICKET_CREATED = 'ticket_created',
  TICKET_UPDATED = 'ticket_updated',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_RESOLVED = 'ticket_resolved',
  SYSTEM_EVENT = 'system_event'
}

export enum ActivitySeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface ContentPart {
  type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'thinking';
  content: string;
  metadata?: Record<string, any>;
}

export interface ContentParts {
  input: ContentPart[];
  output: ContentPart[];
}

export interface Activity {
  id: string;
  agentId: string;
  activityType: ActivityType;
  description: string;
  inputPrompt?: string;
  output?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: Record<string, any>;
  contentParts?: ContentParts;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number;
  duration: number;
  timestamp: string;
  ticketId?: string;
  metadata: Record<string, any>;
}

export interface ActivityWithTicket extends Activity {
  ticket?: {
    id: string;
    title: string;
    status: string;
    priority: string;
  };
}

export interface TokenEfficiencyMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  cacheHitRate: number;
  tokensPerSecond: number;
  costEstimate?: number;
}

// ============================================================================
// TICKET TYPES
// ============================================================================

export enum TicketStatus {
  BACKLOG = 'Backlog',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'InProgress',
  REVIEW = 'Review',
  DONE = 'Done'
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL'
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId?: string;
  assignee?: {
    id: string;
    name: string;
  };
  reporterId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface TicketHistoryEntry {
  id: string;
  ticketId: string;
  changeType: 'STATUS_CHANGE' | 'ASSIGNMENT_CHANGE' | 'PRIORITY_CHANGE' | 'COMMENT';
  fromValue?: any;
  toValue?: any;
  changedBy: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName?: string;
  content: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface TicketWithDetails extends Ticket {
  history: TicketHistoryEntry[];
  comments: TicketComment[];
  relatedActivities: Activity[];
  tokenUsage: {
    totalInput: number;
    totalOutput: number;
    total: number;
    byActivity: Activity[];
  };
}

// ============================================================================
// KNOWLEDGE TYPES
// ============================================================================

export interface KnowledgeFile {
  name: string;
  path: string;
  content: string;
  lastModified: string;
  size: number;
}

export interface KnowledgeIndex {
  files: KnowledgeFile[];
  totalSize: number;
  lastUpdated: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface SystemConfig {
  database: {
    type: 'postgresql' | 'sqlite';
    url: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    maxSize: string;
    maxFiles: number;
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    autoRefresh: boolean;
    refreshInterval: number;
  };
  notifications: {
    enabled: boolean;
    webhook?: string;
    email?: {
      enabled: boolean;
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
  };
  gateway: {
    host: string;
    port: number;
    secure: boolean;
    apiKey?: string;
  };
  cron: {
    jobs: Array<{
      id: string;
      name: string;
      schedule: string;
      enabled: boolean;
      lastRun?: string;
      nextRun?: string;
    }>;
  };
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardSnapshot {
  type: 'snapshot';
  timestamp: string;
  agents: AgentWithStats[];
  tickets: Ticket[];
  activities: Activity[];
  summary: {
    totalAgents: number;
    onlineAgents: number;
    offlineAgents: number;
    totalTokensUsed: number;
    systemHealth: 'Healthy' | 'Degraded' | 'Unhealthy';
  };
}

// ============================================================================
// SSE EVENT TYPES
// ============================================================================

export type SSEEvent =
  | { type: 'agent_status_change'; agentId: string; status: AgentStatus; timestamp: string }
  | { type: 'activity_created'; activity: Activity }
  | { type: 'ticket_updated'; ticket: Ticket }
  | { type: 'snapshot'; data: DashboardSnapshot }
  | { type: 'ping'; timestamp: string };
