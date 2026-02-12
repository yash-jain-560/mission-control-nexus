/**
 * Express API Server
 * Mission Control Nexus - Agent Status API
 * 
 * Performance: <200ms p95 latency, 99.5% uptime
 * Features: Request logging, error handling, rate limiting, health checks
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { getDatabase } from '../db/connection';
import { getCache } from '../cache/redis';
import logger from '../utils/logger';
import {
  getAllAgentsStatus,
  getAgentStatus,
  getAgentHealth,
  updateAgentHeartbeat,
  deleteAgent
} from './agents';

export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
  trustProxy: boolean;
}

/**
 * Request logging middleware
 */
function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Warn on slow requests
    if (duration > 200) {
      logger.warn(`Slow request detected (${duration}ms): ${req.method} ${req.url}`);
    }
  });

  next();
}

/**
 * Error handling middleware
 */
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

/**
 * 404 handler
 */
function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.url,
    method: req.method
  });
}

/**
 * Create and configure Express app
 */
export function createApp(config: ServerConfig): Express {
  const app = express();

  // Trust proxy (for rate limiting, IP detection)
  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: config.rateLimit.windowMs / 1000
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const db = getDatabase();
      const cache = getCache();

      const [dbHealth, cacheHealth] = await Promise.all([
        db.healthCheck(),
        cache.healthCheck()
      ]);

      const cacheStats = cache.getStats();

      const overallHealthy = dbHealth.healthy && 
        (cacheHealth.healthy || !process.env.REDIS_ENABLED);

      res.status(overallHealthy ? 200 : 503).json({
        success: true,
        status: overallHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          healthy: dbHealth.healthy,
          latency: dbHealth.latency
        },
        cache: {
          healthy: cacheHealth.healthy,
          latency: cacheHealth.latency,
          enabled: process.env.REDIS_ENABLED !== 'false',
          stats: cacheStats
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
        }
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // API Routes
  app.get('/api/agents/status', getAllAgentsStatus);
  app.get('/api/agents/:agentId/status', getAgentStatus);
  app.get('/api/agents/:agentId/health', getAgentHealth);
  app.post('/api/agents/:agentId/heartbeat', updateAgentHeartbeat);
  app.delete('/api/agents/:agentId', deleteAgent);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the API server
 */
export async function startServer(config: ServerConfig): Promise<void> {
  try {
    // Initialize database
    logger.info('Initializing database...');
    const db = getDatabase();
    await db.connect();
    await db.migrate();

    // Initialize cache
    logger.info('Initializing cache...');
    const cache = getCache();
    await cache.connect();

    // Create Express app
    const app = createApp(config);

    // Start server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`🚀 Mission Control Nexus API Server started`);
      logger.info(`📡 Listening on http://${config.host}:${config.port}`);
      logger.info(`🔍 Health check: http://${config.host}:${config.port}/health`);
      logger.info(`📊 Agent status: http://${config.host}:${config.port}/api/agents/status`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await db.close();
        await cache.close();
        logger.info('Server closed successfully');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      server.close(async () => {
        await db.close();
        await cache.close();
        logger.info('Server closed successfully');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Default configuration from environment
 */
export function getServerConfig(): ServerConfig {
  return {
    port: parseInt(process.env.API_PORT || '3000'),
    host: process.env.API_HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
      max: parseInt(process.env.RATE_LIMIT_MAX || '100') // 100 requests per minute
    },
    trustProxy: process.env.TRUST_PROXY === 'true'
  };
}

// Start server if run directly
if (require.main === module) {
  const config = getServerConfig();
  startServer(config).catch((error) => {
    logger.error('Server startup failed:', error);
    process.exit(1);
  });
}
