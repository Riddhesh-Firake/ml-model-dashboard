import { Pool, PoolClient, PoolConfig } from 'pg';
import { DatabaseConfig } from '../config/database.config';
import { DatabaseError } from '../models/error.model';
import { DatabaseMonitor } from './monitoring';

export class DatabaseConnection {
  private pool: Pool;
  private config: DatabaseConfig;
  private monitor?: DatabaseMonitor;

  constructor(config: DatabaseConfig, enableMonitoring: boolean = false) {
    this.config = config;
    this.pool = this.createPool();
    
    if (enableMonitoring) {
      this.monitor = new DatabaseMonitor(this);
    }
  }

  private createPool(): Pool {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: this.config.maxConnections,
      connectionTimeoutMillis: this.config.connectionTimeout,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false
    };

    const pool = new Pool(poolConfig);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    return pool;
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      throw new DatabaseError('Failed to get database client', { error });
    }
  }

  /**
   * Execute a query with automatic client management
   */
  async query(text: string, params?: any[]): Promise<any> {
    const startTime = Date.now();
    const client = await this.getClient();
    
    try {
      const result = await client.query(text, params);
      
      // Record query metrics if monitoring is enabled
      if (this.monitor) {
        const executionTime = Date.now() - startTime;
        this.monitor.recordQuery(executionTime);
      }
      
      return result;
    } catch (error) {
      throw new DatabaseError('Query execution failed', { query: text, params, error });
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Transaction failed', { error });
    } finally {
      client.release();
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      return !!result;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      throw new DatabaseError('Failed to close database connections', { error });
    }
  }

  /**
   * Get pool status
   */
  getPoolStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Get database monitor instance
   */
  getMonitor(): DatabaseMonitor | undefined {
    return this.monitor;
  }

  /**
   * Enable monitoring
   */
  enableMonitoring(): DatabaseMonitor {
    if (!this.monitor) {
      this.monitor = new DatabaseMonitor(this);
    }
    return this.monitor;
  }
}