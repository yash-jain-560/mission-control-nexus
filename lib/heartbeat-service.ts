/**
 * Heartbeat Service
 * Automated heartbeat system for agents
 * No manual intervention required - agents auto-register and stay online
 */

import { prisma } from './prisma';
import { logActivity, ACTIVITY_TYPES } from './activity-logger';

// Heartbeat configuration
const HEARTBEAT_CONFIG = {
  // How often to check agent status (ms)
  CHECK_INTERVAL: 30000, // 30 seconds
  // How long before an agent is considered offline (ms)
  OFFLINE_THRESHOLD: 60000, // 60 seconds
  // Auto-cleanup inactive agents after (ms)
  CLEANUP_THRESHOLD: 7 * 24 * 60 * 60 * 1000, // 7 days
};

interface HeartbeatData {
  agentId: string;
  name: string;
  type: string;
  status: string;
  tokensUsed?: number;
  tokensAvailable?: number;
  health?: any;
  metadata?: any;
}

/**
 * Auto-register or update an agent with heartbeat
 */
export async function autoHeartbeat(data: HeartbeatData): Promise<boolean> {
  try {
    const now = new Date();
    
    // Upsert agent - auto-register if doesn't exist
    const agent = await prisma.agent.upsert({
      where: { id: data.agentId },
      update: {
        name: data.name,
        type: data.type,
        status: data.status || 'IDLE',
        tokensUsed: data.tokensUsed !== undefined ? data.tokensUsed : undefined,
        tokensAvailable: data.tokensAvailable !== undefined ? data.tokensAvailable : undefined,
        health: data.health || {},
        metadata: data.metadata || {},
        lastHeartbeat: now,
        lastActive: now,
      },
      create: {
        id: data.agentId,
        name: data.name,
        type: data.type,
        status: data.status || 'IDLE',
        tokensAvailable: data.tokensAvailable || 1000000,
        health: data.health || {},
        metadata: data.metadata || {},
        lastHeartbeat: now,
        lastActive: now,
        currentStatusSince: now,
      },
    });

    // Record heartbeat
    await prisma.heartbeat.create({
      data: {
        agentId: data.agentId,
        timestamp: now,
        status: data.status || 'IDLE',
        health: data.health || {},
        metadata: data.metadata || {},
      },
    });

    return true;
  } catch (error) {
    console.error('Heartbeat error:', error);
    return false;
  }
}

/**
 * Check and update agent online status based on last heartbeat
 */
export async function updateAgentOnlineStatus(): Promise<void> {
  try {
    const now = Date.now();
    const offlineThreshold = HEARTBEAT_CONFIG.OFFLINE_THRESHOLD;

    // Find agents that haven't sent a heartbeat recently and aren't already OFFLINE
    const staleAgents = await prisma.agent.findMany({
      where: {
        status: { not: 'OFFLINE' },
        lastHeartbeat: {
          lt: new Date(now - offlineThreshold),
        },
      },
    });

    // Mark them as offline
    for (const agent of staleAgents) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: 'OFFLINE',
        },
      });

      // Log the status change
      await logActivity({
        agentId: agent.id,
        activityType: ACTIVITY_TYPES.STATUS_CHANGE,
        description: `Agent went offline due to missed heartbeats`,
        metadata: { 
          previousStatus: agent.status,
          lastHeartbeat: agent.lastHeartbeat,
        },
      });
    }
  } catch (error) {
    console.error('Error updating agent status:', error);
  }
}

/**
 * Get system health metrics
 */
export async function getSystemHealth(): Promise<{
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  averageResponseTime: number;
  errorRate: number;
  healthScore: number;
}> {
  try {
    const [agents, recentHeartbeats] = await Promise.all([
      prisma.agent.findMany(),
      prisma.heartbeat.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
    ]);

    // Calculate online agents based on recent heartbeat (within 60 seconds)
    const onlineThreshold = Date.now() - 60000;
    const onlineAgents = agents.filter(a => new Date(a.lastHeartbeat).getTime() > onlineThreshold).length;
    const offlineAgents = agents.length - onlineAgents;

    // Calculate health metrics
    const totalAgents = agents.length;
    const healthChecks = recentHeartbeats.filter(h => h.health).length;
    const errorCount = recentHeartbeats.filter(h => {
      const health = h.health as any;
      return health?.status === 'unhealthy' || health?.errors?.length > 0;
    }).length;

    const errorRate = healthChecks > 0 ? (errorCount / healthChecks) * 100 : 0;
    
    // Calculate average response time
    const responseTimes = recentHeartbeats
      .map(h => (h.health as any)?.metrics?.responseTime)
      .filter((rt): rt is number => typeof rt === 'number');
    
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Health score: 0-100
    const onlineRatio = totalAgents > 0 ? onlineAgents / totalAgents : 1;
    const healthScore = Math.round((onlineRatio * 100) - (errorRate * 0.5));

    return {
      totalAgents,
      onlineAgents,
      offlineAgents,
      averageResponseTime,
      errorRate,
      healthScore: Math.max(0, Math.min(100, healthScore)),
    };
  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      totalAgents: 0,
      onlineAgents: 0,
      offlineAgents: 0,
      averageResponseTime: 0,
      errorRate: 0,
      healthScore: 0,
    };
  }
}

/**
 * Background heartbeat checker
 * Call this periodically to update agent statuses
 */
export function startHeartbeatMonitor(): void {
  // Run immediately
  updateAgentOnlineStatus();
  
  // Then run periodically
  setInterval(updateAgentOnlineStatus, HEARTBEAT_CONFIG.CHECK_INTERVAL);
  
  console.log('[Heartbeat] Monitor started with interval:', HEARTBEAT_CONFIG.CHECK_INTERVAL, 'ms');
}

/**
 * Cleanup old heartbeats to prevent database bloat
 */
export async function cleanupOldHeartbeats(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // Keep 24 hours
    
    const result = await prisma.heartbeat.deleteMany({
      where: {
        timestamp: {
          lt: cutoff,
        },
      },
    });

    console.log(`[Heartbeat] Cleaned up ${result.count} old heartbeats`);
    return result.count;
  } catch (error) {
    console.error('Error cleaning up old heartbeats:', error);
    return 0;
  }
}

export default {
  autoHeartbeat,
  updateAgentOnlineStatus,
  getSystemHealth,
  startHeartbeatMonitor,
  cleanupOldHeartbeats,
  HEARTBEAT_CONFIG,
};