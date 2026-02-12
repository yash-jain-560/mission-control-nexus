/**
 * Database Schema for Agent Status Tracking
 * Mission Control Nexus - Agent Status API (Ticket 1, Phase 1)
 * 
 * Purpose: Track agent status, health metrics, and heartbeat data
 * Database: PostgreSQL with fallback to SQLite
 * Performance Target: <200ms p95 latency
 */

export interface AgentStatus {
  id: string; // UUID
  agentId: string; // Unique agent identifier
  name: string; // Human-readable agent name
  type: string; // e.g., 'personal', 'work', 'research'
  status: AgentStatusEnum; // Current operational status
  health: HealthStatus; // Health check status
  lastHeartbeat: Date; // Last heartbeat timestamp
  lastActive: Date; // Last active timestamp
  metadata: Record<string, any>; // Flexible metadata (JSON)
  createdAt: Date;
  updatedAt: Date;
}

export enum AgentStatusEnum {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  metrics: HealthMetrics;
  errors?: string[];
}

export interface HealthMetrics {
  uptime: number; // seconds
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  taskQueueLength: number;
  responseTime: number; // ms
  errorRate: number; // percentage
}

export interface AgentHeartbeat {
  id: string; // UUID
  agentId: string;
  timestamp: Date;
  status: AgentStatusEnum;
  health: HealthStatus;
  metadata: Record<string, any>;
}

export interface AgentHistory {
  id: string; // UUID
  agentId: string;
  changeType: 'STATUS_CHANGE' | 'HEALTH_UPDATE' | 'HEARTBEAT' | 'ERROR';
  fromValue?: any; // JSON
  toValue?: any; // JSON
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * SQL Schema for PostgreSQL
 */
export const POSTGRES_SCHEMA = `
-- Agent Status Table
CREATE TABLE IF NOT EXISTS agent_status (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ONLINE', 'OFFLINE', 'IDLE', 'BUSY', 'ERROR', 'UNKNOWN')),
  health JSONB NOT NULL DEFAULT '{"status": "unknown", "lastCheck": null, "metrics": {}}',
  last_heartbeat TIMESTAMP NOT NULL,
  last_active TIMESTAMP NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_agent_id (agent_id),
  INDEX idx_status (status),
  INDEX idx_last_heartbeat (last_heartbeat),
  INDEX idx_last_active (last_active)
);

-- Agent Heartbeat Table (for historical tracking)
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL,
  health JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  INDEX idx_agent_id (agent_id),
  INDEX idx_timestamp (timestamp),
  
  FOREIGN KEY (agent_id) REFERENCES agent_status(agent_id) ON DELETE CASCADE
);

-- Agent History Table (audit trail)
CREATE TABLE IF NOT EXISTS agent_history (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  change_type VARCHAR(50) NOT NULL,
  from_value JSONB,
  to_value JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  
  INDEX idx_agent_id (agent_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_change_type (change_type)
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_status_updated_at
BEFORE UPDATE ON agent_status
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
`;

/**
 * SQL Schema for SQLite (fallback)
 */
export const SQLITE_SCHEMA = `
-- Agent Status Table
CREATE TABLE IF NOT EXISTS agent_status (
  id TEXT PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ONLINE', 'OFFLINE', 'IDLE', 'BUSY', 'ERROR', 'UNKNOWN')),
  health TEXT NOT NULL DEFAULT '{"status": "unknown", "lastCheck": null, "metrics": {}}',
  last_heartbeat DATETIME NOT NULL,
  last_active DATETIME NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_id ON agent_status(agent_id);
CREATE INDEX IF NOT EXISTS idx_status ON agent_status(status);
CREATE INDEX IF NOT EXISTS idx_last_heartbeat ON agent_status(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_last_active ON agent_status(last_active);

-- Agent Heartbeat Table
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  status TEXT NOT NULL,
  health TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY (agent_id) REFERENCES agent_status(agent_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_agent_id ON agent_heartbeats(agent_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_timestamp ON agent_heartbeats(timestamp);

-- Agent History Table
CREATE TABLE IF NOT EXISTS agent_history (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_history_agent_id ON agent_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON agent_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_history_change_type ON agent_history(change_type);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_agent_status_updated_at
AFTER UPDATE ON agent_status
FOR EACH ROW
BEGIN
  UPDATE agent_status SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`;

/**
 * Database migration functions
 */
export interface DatabaseMigration {
  version: string;
  name: string;
  up: string;
  down: string;
}

export const migrations: DatabaseMigration[] = [
  {
    version: '001',
    name: 'initial_agent_status_schema',
    up: POSTGRES_SCHEMA,
    down: `
      DROP TRIGGER IF EXISTS update_agent_status_updated_at ON agent_status;
      DROP FUNCTION IF EXISTS update_updated_at_column();
      DROP TABLE IF EXISTS agent_history;
      DROP TABLE IF EXISTS agent_heartbeats;
      DROP TABLE IF EXISTS agent_status;
    `
  }
];
