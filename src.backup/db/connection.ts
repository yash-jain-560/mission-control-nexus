/**
 * Database Connection Manager
 * Mission Control Nexus - Agent Status API
 * 
 * Supports PostgreSQL (primary) and SQLite (fallback)
 * Performance: Connection pooling, prepared statements
 */

import { Pool, PoolClient } from 'pg';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { POSTGRES_SCHEMA, SQLITE_SCHEMA, migrations } from './schema';

export type DatabaseType = 'postgres' | 'sqlite';

export interface DatabaseConfig {
  type: DatabaseType;
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max: number; // Connection pool size
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  sqlite?: {
    filename: string;
  };
}

class Database {
  private config: DatabaseConfig;
  private pgPool?: Pool;
  private sqliteDb?: sqlite3.Database;
  private type: DatabaseType;
  private isConnected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.type = config.type;
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      if (this.type === 'postgres') {
        await this.connectPostgres();
      } else {
        await this.connectSqlite();
      }
      this.isConnected = true;
      logger.info(`Database connected (${this.type})`);
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Connect to PostgreSQL
   */
  private async connectPostgres(): Promise<void> {
    if (!this.config.postgres) {
      throw new Error('PostgreSQL configuration missing');
    }

    this.pgPool = new Pool({
      host: this.config.postgres.host,
      port: this.config.postgres.port,
      database: this.config.postgres.database,
      user: this.config.postgres.user,
      password: this.config.postgres.password,
      max: this.config.postgres.max,
      idleTimeoutMillis: this.config.postgres.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.postgres.connectionTimeoutMillis,
    });

    // Test connection
    const client = await this.pgPool.connect();
    await client.query('SELECT NOW()');
    client.release();
  }

  /**
   * Connect to SQLite
   */
  private async connectSqlite(): Promise<void> {
    if (!this.config.sqlite) {
      throw new Error('SQLite configuration missing');
    }

    return new Promise((resolve, reject) => {
      this.sqliteDb = new sqlite3.Database(
        this.config.sqlite!.filename,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => {
          if (err) {
            reject(err);
          } else {
            // Enable WAL mode for better concurrency
            this.sqliteDb!.run('PRAGMA journal_mode = WAL;');
            resolve();
          }
        }
      );
    });
  }

  /**
   * Execute a query (supports both PostgreSQL and SQLite)
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    if (this.type === 'postgres') {
      return this.queryPostgres<T>(sql, params);
    } else {
      return this.querySqlite<T>(sql, params);
    }
  }

  /**
   * Execute PostgreSQL query
   */
  private async queryPostgres<T>(sql: string, params: any[]): Promise<T[]> {
    if (!this.pgPool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const startTime = Date.now();
    try {
      const result = await this.pgPool.query(sql, params);
      const duration = Date.now() - startTime;
      
      if (duration > 100) {
        logger.warn(`Slow query detected (${duration}ms):`, sql.substring(0, 100));
      }

      return result.rows as T[];
    } catch (error) {
      logger.error('PostgreSQL query error:', { sql, error });
      throw error;
    }
  }

  /**
   * Execute SQLite query
   */
  private async querySqlite<T>(sql: string, params: any[]): Promise<T[]> {
    if (!this.sqliteDb) {
      throw new Error('SQLite database not initialized');
    }

    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      this.sqliteDb!.all(sql, params, (err, rows) => {
        const duration = Date.now() - startTime;
        
        if (err) {
          logger.error('SQLite query error:', { sql, error: err });
          reject(err);
        } else {
          if (duration > 100) {
            logger.warn(`Slow query detected (${duration}ms):`, sql.substring(0, 100));
          }
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * Execute a single query and return first result
   */
  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute an insert/update/delete query
   */
  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: string }> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    if (this.type === 'postgres') {
      const result = await this.pgPool!.query(sql, params);
      return {
        affectedRows: result.rowCount || 0,
        insertId: result.rows[0]?.id
      };
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb!.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              affectedRows: this.changes,
              insertId: this.lastID?.toString()
            });
          }
        });
      });
    }
  }

  /**
   * Run database migrations
   */
  async migrate(): Promise<void> {
    logger.info('Running database migrations...');

    try {
      // Create migrations table if not exists
      const migrationTableSql = this.type === 'postgres'
        ? `CREATE TABLE IF NOT EXISTS migrations (
            version VARCHAR(10) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        : `CREATE TABLE IF NOT EXISTS migrations (
            version TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`;

      await this.execute(migrationTableSql);

      // Get applied migrations
      const appliedMigrations = await this.query<{ version: string }>(
        'SELECT version FROM migrations ORDER BY version'
      );
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));

      // Apply pending migrations
      for (const migration of migrations) {
        if (!appliedVersions.has(migration.version)) {
          logger.info(`Applying migration ${migration.version}: ${migration.name}`);
          
          // Execute migration
          const schema = this.type === 'postgres' ? POSTGRES_SCHEMA : SQLITE_SCHEMA;
          await this.execute(schema);

          // Record migration
          await this.execute(
            'INSERT INTO migrations (version, name) VALUES (?, ?)',
            [migration.version, migration.name]
          );

          logger.info(`Migration ${migration.version} applied successfully`);
        }
      }

      logger.info('All migrations applied successfully');
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      logger.info('PostgreSQL connection closed');
    }
    if (this.sqliteDb) {
      await new Promise<void>((resolve, reject) => {
        this.sqliteDb!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('SQLite connection closed');
    }
    this.isConnected = false;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now();
    try {
      await this.query('SELECT 1');
      const latency = Date.now() - startTime;
      return { healthy: true, latency };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return { healthy: false, latency: Date.now() - startTime };
    }
  }
}

/**
 * Default configuration from environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  const dbType = (process.env.DB_TYPE || 'sqlite') as DatabaseType;

  if (dbType === 'postgres') {
    return {
      type: 'postgres',
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'mission_control',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        max: parseInt(process.env.POSTGRES_POOL_SIZE || '10'),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    };
  } else {
    return {
      type: 'sqlite',
      sqlite: {
        filename: process.env.SQLITE_FILE || './data/mission-control.db'
      }
    };
  }
}

// Singleton instance
let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    const config = getDatabaseConfig();
    dbInstance = new Database(config);
  }
  return dbInstance;
}

export default Database;
