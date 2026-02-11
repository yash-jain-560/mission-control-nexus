export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  type: AgentType;
  lastSeen: Date;
  capabilities: string[];
  healthScore: number;
  location?: string;
  metadata: Record<string, any>;
}

export enum AgentStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy',
  IDLE = 'idle',
  ERROR = 'error',
  MAINTENANCE = 'maintenance'
}

export enum AgentType {
  WORKER = 'worker',
  COORDINATOR = 'coordinator',
  MONITOR = 'monitor',
  STORAGE = 'storage',
  API = 'api'
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee?: string;
  reporter: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  tags: string[];
  metadata: Record<string, any>;
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

export interface ActivityLog {
  id: string;
  timestamp: Date;
  type: ActivityType;
  agentId?: string;
  ticketId?: string;
  userId: string;
  action: string;
  details: Record<string, any>;
  severity: ActivitySeverity;
}

export enum ActivityType {
  AGENT_STATUS_CHANGE = 'agent_status_change',
  TICKET_CREATED = 'ticket_created',
  TICKET_UPDATED = 'ticket_updated',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_RESOLVED = 'ticket_resolved',
  SYSTEM_EVENT = 'system_event',
  ERROR = 'error',
  WARNING = 'warning'
}

export enum ActivitySeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface Configuration {
  database: {
    path: string;
    type: 'file' | 'memory';
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    maxSize: string;
    maxFiles: number;
  };
  ui: {
    theme: 'light' | 'dark';
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
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}