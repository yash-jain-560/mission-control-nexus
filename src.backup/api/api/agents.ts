/**
 * Agent Status API Controller
 * Mission Control Nexus - Agent Status API (Ticket 1, Phase 1)
 * 
 * Endpoints:
 * - GET /api/agents/status (all agents)
 * - GET /api/agents/{agentId}/status (single agent)
 * - GET /api/agents/{agentId}/health (health check)
 * - POST /api/agents/{agentId}/heartbeat (status update)
 * 
 * Performance Target: <200ms p95 latency
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/connection';
import { getCache } from '../cache/redis';
import logger from '../utils/logger';
import {
  AgentStatus,
  AgentStatusEnum,
  HealthStatus,
  AgentHeartbeat,
  AgentHistory
} from '../db/schema';

/**
 * GET /api/agents/status
 * Retrieve status of all agents
 */
export async function getAllAgentsStatus(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info('GET /api/agents/status');

    const db = getDatabase();
    const cache = getCache();

    // Try cache first
    const cached = await cache.getAgentList();
    if (cached) {
      const duration = Date.now() - startTime;
      logger.info(`All agents status retrieved from cache (${duration}ms)`);
      res.status(200).json({
        success: true,
        data: cached,
        count: cached.length,
        cached: true,
        responseTime: duration
      });
      return;
    }

    // Query database
    const agents = await db.query<AgentStatus>(
      `SELECT 
        id, agent_id as "agentId", name, type, status,
        health, last_heartbeat as "lastHeartbeat", 
        last_active as "lastActive", metadata,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM agent_status
      ORDER BY last_active DESC`
    );

    // Parse JSON fields (for SQLite compatibility)
    const parsedAgents = agents.map(agent => ({
      ...agent,
      health: typeof agent.health === 'string' ? JSON.parse(agent.health) : agent.health,
      metadata: typeof agent.metadata === 'string' ? JSON.parse(agent.metadata) : agent.metadata
    }));

    // Cache the result
    await cache.setAgentList(parsedAgents);

    const duration = Date.now() - startTime;
    logger.info(`All agents status retrieved from database (${duration}ms, ${agents.length} agents)`);

    res.status(200).json({
      success: true,
      data: parsedAgents,
      count: parsedAgents.length,
      cached: false,
      responseTime: duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching all agents status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: duration
    });
  }
}

/**
 * GET /api/agents/:agentId/status
 * Retrieve status of a single agent
 */
export async function getAgentStatus(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    const { agentId } = req.params;

    if (!agentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameter: agentId',
        responseTime: Date.now() - startTime
      });
      return;
    }

    logger.info(`GET /api/agents/${agentId}/status`);

    const db = getDatabase();
    const cache = getCache();

    // Try cache first
    const cached = await cache.getAgentStatus(agentId);
    if (cached) {
      const duration = Date.now() - startTime;
      logger.info(`Agent ${agentId} status retrieved from cache (${duration}ms)`);
      res.status(200).json({
        success: true,
        data: cached,
        cached: true,
        responseTime: duration
      });
      return;
    }

    // Query database
    const agent = await db.queryOne<AgentStatus>(
      `SELECT 
        id, agent_id as "agentId", name, type, status,
        health, last_heartbeat as "lastHeartbeat",
        last_active as "lastActive", metadata,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM agent_status
      WHERE agent_id = ?`,
      [agentId]
    );

    if (!agent) {
      const duration = Date.now() - startTime;
      logger.warn(`Agent ${agentId} not found`);
      res.status(404).json({
        success: false,
        error: 'Agent not found',
        agentId,
        responseTime: duration
      });
      return;
    }

    // Parse JSON fields
    const parsedAgent = {
      ...agent,
      health: typeof agent.health === 'string' ? JSON.parse(agent.health) : agent.health,
      metadata: typeof agent.metadata === 'string' ? JSON.parse(agent.metadata) : agent.metadata
    };

    // Cache the result
    await cache.setAgentStatus(agentId, parsedAgent);

    const duration = Date.now() - startTime;
    logger.info(`Agent ${agentId} status retrieved from database (${duration}ms)`);

    res.status(200).json({
      success: true,
      data: parsedAgent,
      cached: false,
      responseTime: duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching agent status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: duration
    });
  }
}

/**
 * GET /api/agents/:agentId/health
 * Retrieve health status of a single agent
 */
export async function getAgentHealth(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    const { agentId } = req.params;

    if (!agentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameter: agentId',
        responseTime: Date.now() - startTime
      });
      return;
    }

    logger.info(`GET /api/agents/${agentId}/health`);

    const db = getDatabase();
    const cache = getCache();

    // Try cache first
    const cached = await cache.getAgentHealth(agentId);
    if (cached) {
      const duration = Date.now() - startTime;
      logger.info(`Agent ${agentId} health retrieved from cache (${duration}ms)`);
      res.status(200).json({
        success: true,
        data: cached,
        cached: true,
        responseTime: duration
      });
      return;
    }

    // Query database
    const agent = await db.queryOne<{ health: string | HealthStatus }>(
      'SELECT health FROM agent_status WHERE agent_id = ?',
      [agentId]
    );

    if (!agent) {
      const duration = Date.now() - startTime;
      logger.warn(`Agent ${agentId} not found`);
      res.status(404).json({
        success: false,
        error: 'Agent not found',
        agentId,
        responseTime: duration
      });
      return;
    }

    // Parse JSON field
    const health = typeof agent.health === 'string' 
      ? JSON.parse(agent.health) 
      : agent.health;

    // Cache the result
    await cache.setAgentHealth(agentId, health);

    const duration = Date.now() - startTime;
    logger.info(`Agent ${agentId} health retrieved from database (${duration}ms)`);

    res.status(200).json({
      success: true,
      data: health,
      cached: false,
      responseTime: duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching agent health:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: duration
    });
  }
}

/**
 * POST /api/agents/:agentId/heartbeat
 * Update agent status via heartbeat
 */
export async function updateAgentHeartbeat(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    const { agentId } = req.params;
    const { status, health, metadata = {} } = req.body;

    if (!agentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameter: agentId',
        responseTime: Date.now() - startTime
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: status',
        required: ['status'],
        optional: ['health', 'metadata'],
        responseTime: Date.now() - startTime
      });
      return;
    }

    // Validate status enum
    if (!Object.values(AgentStatusEnum).includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status value',
        validValues: Object.values(AgentStatusEnum),
        received: status,
        responseTime: Date.now() - startTime
      });
      return;
    }

    logger.info(`POST /api/agents/${agentId}/heartbeat`, { status, health });

    const db = getDatabase();
    const cache = getCache();
    const now = new Date();

    // Check if agent exists
    const existingAgent = await db.queryOne<AgentStatus>(
      'SELECT * FROM agent_status WHERE agent_id = ?',
      [agentId]
    );

    let agent: AgentStatus;
    let isNew = false;

    if (!existingAgent) {
      // Create new agent
      isNew = true;
      const id = uuidv4();
      
      agent = {
        id,
        agentId,
        name: metadata.name || agentId,
        type: metadata.type || 'unknown',
        status,
        health: health || {
          status: 'unknown',
          lastCheck: now,
          metrics: {
            uptime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            taskQueueLength: 0,
            responseTime: 0,
            errorRate: 0
          }
        },
        lastHeartbeat: now,
        lastActive: now,
        metadata,
        createdAt: now,
        updatedAt: now
      };

      await db.execute(
        `INSERT INTO agent_status 
        (id, agent_id, name, type, status, health, last_heartbeat, last_active, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          agent.id,
          agent.agentId,
          agent.name,
          agent.type,
          agent.status,
          JSON.stringify(agent.health),
          agent.lastHeartbeat,
          agent.lastActive,
          JSON.stringify(agent.metadata),
          agent.createdAt,
          agent.updatedAt
        ]
      );

      logger.info(`New agent created: ${agentId}`);
    } else {
      // Update existing agent
      const updatedHealth = health || existingAgent.health;
      
      agent = {
        ...existingAgent,
        status,
        health: updatedHealth,
        lastHeartbeat: now,
        lastActive: now,
        metadata: { ...existingAgent.metadata, ...metadata },
        updatedAt: now
      };

      await db.execute(
        `UPDATE agent_status 
        SET status = ?, health = ?, last_heartbeat = ?, last_active = ?, metadata = ?, updated_at = ?
        WHERE agent_id = ?`,
        [
          agent.status,
          JSON.stringify(agent.health),
          agent.lastHeartbeat,
          agent.lastActive,
          JSON.stringify(agent.metadata),
          agent.updatedAt,
          agentId
        ]
      );

      logger.info(`Agent ${agentId} updated: ${status}`);
    }

    // Record heartbeat in history
    const heartbeatId = uuidv4();
    await db.execute(
      `INSERT INTO agent_heartbeats (id, agent_id, timestamp, status, health, metadata)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        heartbeatId,
        agentId,
        now,
        status,
        JSON.stringify(agent.health),
        JSON.stringify(metadata)
      ]
    );

    // Record in audit history
    const historyId = uuidv4();
    await db.execute(
      `INSERT INTO agent_history (id, agent_id, change_type, from_value, to_value, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        historyId,
        agentId,
        'HEARTBEAT',
        JSON.stringify({ status: existingAgent?.status }),
        JSON.stringify({ status }),
        now,
        JSON.stringify(metadata)
      ]
    );

    // Invalidate cache
    await cache.invalidateAgent(agentId);

    const duration = Date.now() - startTime;
    logger.info(`Heartbeat processed for ${agentId} (${duration}ms)`);

    res.status(isNew ? 201 : 200).json({
      success: true,
      data: agent,
      message: isNew ? 'Agent created' : 'Heartbeat recorded',
      responseTime: duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error processing heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: duration
    });
  }
}

/**
 * DELETE /api/agents/:agentId (bonus endpoint)
 * Remove an agent from tracking
 */
export async function deleteAgent(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    const { agentId } = req.params;

    if (!agentId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameter: agentId',
        responseTime: Date.now() - startTime
      });
      return;
    }

    logger.info(`DELETE /api/agents/${agentId}`);

    const db = getDatabase();
    const cache = getCache();

    // Check if agent exists
    const agent = await db.queryOne(
      'SELECT agent_id FROM agent_status WHERE agent_id = ?',
      [agentId]
    );

    if (!agent) {
      const duration = Date.now() - startTime;
      res.status(404).json({
        success: false,
        error: 'Agent not found',
        agentId,
        responseTime: duration
      });
      return;
    }

    // Delete agent (cascade will delete heartbeats and history)
    await db.execute('DELETE FROM agent_status WHERE agent_id = ?', [agentId]);

    // Invalidate cache
    await cache.invalidateAgent(agentId);

    const duration = Date.now() - startTime;
    logger.info(`Agent ${agentId} deleted (${duration}ms)`);

    res.status(204).send();
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error deleting agent:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: duration
    });
  }
}
