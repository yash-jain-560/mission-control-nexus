/**
 * Redis Caching Layer
 * Mission Control Nexus - Agent Status API
 * 
 * Purpose: High-performance caching for agent status data
 * Target: <200ms p95 latency, cache hit ratio >80%
 */

import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';
import { AgentStatus, AgentStatusEnum, HealthStatus } from '../db/schema';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: {
    agentStatus: number; // seconds
    agentHealth: number;
    agentList: number;
  };
  enabled: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  avgLatency: number;
}

class RedisCache {
  private client?: RedisClientType;
  private config: CacheConfig;
  private isConnected: boolean = false;
  private stats: { hits: number; misses: number; totalLatency: number; operations: number } = {
    hits: 0,
    misses: 0,
    totalLatency: 0,
    operations: 0
  };

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Redis caching disabled');
      return;
    }

    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
        },
        password: this.config.password,
        database: this.config.db,
      });

      this.client.on('error', (err) => {
        logger.error('Redis error:', err);
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis reconnecting...');
      });

      await this.client.connect();
      this.isConnected = true;
      logger.info(`Redis cache initialized (${this.config.host}:${this.config.port})`);
    } catch (error) {
      logger.error('Redis connection failed:', error);
      logger.warn('Continuing without cache');
      this.config.enabled = false;
    }
  }

  /**
   * Generate cache key for agent status
   */
  private getAgentStatusKey(agentId: string): string {
    return `agent:status:${agentId}`;
  }

  /**
   * Generate cache key for agent health
   */
  private getAgentHealthKey(agentId: string): string {
    return `agent:health:${agentId}`;
  }

  /**
   * Generate cache key for agent list
   */
  private getAgentListKey(): string {
    return 'agents:list';
  }

  /**
   * Get agent status from cache
   */
  async getAgentStatus(agentId: string): Promise<AgentStatus | null> {
    if (!this.isEnabled()) return null;

    const startTime = Date.now();
    try {
      const key = this.getAgentStatusKey(agentId);
      const cached = await this.client!.get(key);

      const latency = Date.now() - startTime;
      this.recordOperation(latency);

      if (cached) {
        this.stats.hits++;
        logger.debug(`Cache HIT: agent status ${agentId} (${latency}ms)`);
        return JSON.parse(cached);
      } else {
        this.stats.misses++;
        logger.debug(`Cache MISS: agent status ${agentId}`);
        return null;
      }
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set agent status in cache
   */
  async setAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const key = this.getAgentStatusKey(agentId);
      await this.client!.setEx(
        key,
        this.config.ttl.agentStatus,
        JSON.stringify(status)
      );
      logger.debug(`Cache SET: agent status ${agentId}`);
    } catch (error) {
      logger.error('Redis set error:', error);
    }
  }

  /**
   * Get agent health from cache
   */
  async getAgentHealth(agentId: string): Promise<HealthStatus | null> {
    if (!this.isEnabled()) return null;

    const startTime = Date.now();
    try {
      const key = this.getAgentHealthKey(agentId);
      const cached = await this.client!.get(key);

      const latency = Date.now() - startTime;
      this.recordOperation(latency);

      if (cached) {
        this.stats.hits++;
        logger.debug(`Cache HIT: agent health ${agentId} (${latency}ms)`);
        return JSON.parse(cached);
      } else {
        this.stats.misses++;
        logger.debug(`Cache MISS: agent health ${agentId}`);
        return null;
      }
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set agent health in cache
   */
  async setAgentHealth(agentId: string, health: HealthStatus): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const key = this.getAgentHealthKey(agentId);
      await this.client!.setEx(
        key,
        this.config.ttl.agentHealth,
        JSON.stringify(health)
      );
      logger.debug(`Cache SET: agent health ${agentId}`);
    } catch (error) {
      logger.error('Redis set error:', error);
    }
  }

  /**
   * Get all agents list from cache
   */
  async getAgentList(): Promise<AgentStatus[] | null> {
    if (!this.isEnabled()) return null;

    const startTime = Date.now();
    try {
      const key = this.getAgentListKey();
      const cached = await this.client!.get(key);

      const latency = Date.now() - startTime;
      this.recordOperation(latency);

      if (cached) {
        this.stats.hits++;
        logger.debug(`Cache HIT: agent list (${latency}ms)`);
        return JSON.parse(cached);
      } else {
        this.stats.misses++;
        logger.debug(`Cache MISS: agent list`);
        return null;
      }
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set all agents list in cache
   */
  async setAgentList(agents: AgentStatus[]): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const key = this.getAgentListKey();
      await this.client!.setEx(
        key,
        this.config.ttl.agentList,
        JSON.stringify(agents)
      );
      logger.debug(`Cache SET: agent list (${agents.length} agents)`);
    } catch (error) {
      logger.error('Redis set error:', error);
    }
  }

  /**
   * Invalidate agent cache
   */
  async invalidateAgent(agentId: string): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      await this.client!.del([
        this.getAgentStatusKey(agentId),
        this.getAgentHealthKey(agentId),
        this.getAgentListKey()
      ]);
      logger.debug(`Cache INVALIDATE: agent ${agentId}`);
    } catch (error) {
      logger.error('Redis delete error:', error);
    }
  }

  /**
   * Invalidate all agent caches
   */
  async invalidateAll(): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const keys = await this.client!.keys('agent:*');
      if (keys.length > 0) {
        await this.client!.del(keys);
      }
      logger.info(`Cache INVALIDATE: all agents (${keys.length} keys)`);
    } catch (error) {
      logger.error('Redis invalidate all error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      avgLatency: this.stats.operations > 0 
        ? this.stats.totalLatency / this.stats.operations 
        : 0
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, totalLatency: 0, operations: 0 };
  }

  /**
   * Record cache operation metrics
   */
  private recordOperation(latency: number): void {
    this.stats.totalLatency += latency;
    this.stats.operations++;
  }

  /**
   * Check if cache is enabled and connected
   */
  private isEnabled(): boolean {
    return this.config.enabled && this.isConnected && this.client !== undefined;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    if (!this.isEnabled()) {
      return { healthy: false, latency: 0 };
    }

    const startTime = Date.now();
    try {
      await this.client!.ping();
      const latency = Date.now() - startTime;
      return { healthy: true, latency };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return { healthy: false, latency: Date.now() - startTime };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

/**
 * Default configuration from environment
 */
export function getCacheConfig(): CacheConfig {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    ttl: {
      agentStatus: parseInt(process.env.CACHE_TTL_AGENT_STATUS || '300'), // 5 minutes
      agentHealth: parseInt(process.env.CACHE_TTL_AGENT_HEALTH || '60'), // 1 minute
      agentList: parseInt(process.env.CACHE_TTL_AGENT_LIST || '30'), // 30 seconds
    },
    enabled: process.env.REDIS_ENABLED !== 'false',
  };
}

// Singleton instance
let cacheInstance: RedisCache | null = null;

export function getCache(): RedisCache {
  if (!cacheInstance) {
    const config = getCacheConfig();
    cacheInstance = new RedisCache(config);
  }
  return cacheInstance;
}

export default RedisCache;
