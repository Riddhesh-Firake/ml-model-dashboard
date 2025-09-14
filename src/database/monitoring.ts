import { DatabaseConnection } from './connection';
import { DatabaseError } from '../models/error.model';

export interface ConnectionPoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingConnections: number;
  activeConnections: number;
  timestamp: Date;
}

export interface DatabaseMetrics {
  connectionPool: ConnectionPoolMetrics;
  queryStats?: {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
  };
  health: {
    isHealthy: boolean;
    lastCheck: Date;
    uptime: number;
  };
}

export class DatabaseMonitor {
  private db: DatabaseConnection;
  private startTime: Date;
  private queryCount: number = 0;
  private totalQueryTime: number = 0;
  private slowQueryCount: number = 0;
  private slowQueryThreshold: number = 1000; // 1 second

  constructor(db: DatabaseConnection, slowQueryThreshold: number = 1000) {
    this.db = db;
    this.startTime = new Date();
    this.slowQueryThreshold = slowQueryThreshold;
  }

  /**
   * Get current database metrics
   */
  async getMetrics(): Promise<DatabaseMetrics> {
    try {
      const poolStatus = this.db.getPoolStatus();
      const isHealthy = await this.db.testConnection();
      
      const connectionPool: ConnectionPoolMetrics = {
        totalConnections: poolStatus.totalCount,
        idleConnections: poolStatus.idleCount,
        waitingConnections: poolStatus.waitingCount,
        activeConnections: poolStatus.totalCount - poolStatus.idleCount,
        timestamp: new Date()
      };

      const queryStats = {
        totalQueries: this.queryCount,
        averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
        slowQueries: this.slowQueryCount
      };

      const health = {
        isHealthy,
        lastCheck: new Date(),
        uptime: Date.now() - this.startTime.getTime()
      };

      return {
        connectionPool,
        queryStats,
        health
      };
    } catch (error) {
      throw new DatabaseError('Failed to get database metrics', { error });
    }
  }

  /**
   * Record query execution time
   */
  recordQuery(executionTime: number): void {
    this.queryCount++;
    this.totalQueryTime += executionTime;
    
    if (executionTime > this.slowQueryThreshold) {
      this.slowQueryCount++;
    }
  }

  /**
   * Check if connection pool is healthy
   */
  async isPoolHealthy(): Promise<boolean> {
    try {
      const poolStatus = this.db.getPoolStatus();
      
      // Consider pool unhealthy if:
      // - No idle connections and many waiting
      // - Total connections at maximum but all are idle (potential connection leak)
      const hasWaitingConnections = poolStatus.waitingCount > 0;
      const hasIdleConnections = poolStatus.idleCount > 0;
      const allConnectionsIdle = poolStatus.idleCount === poolStatus.totalCount;
      
      if (hasWaitingConnections && !hasIdleConnections) {
        return false; // Pool exhausted
      }
      
      if (allConnectionsIdle && poolStatus.totalCount > 10) {
        return false; // Potential connection leak
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connection pool warnings
   */
  async getPoolWarnings(): Promise<string[]> {
    const warnings: string[] = [];
    
    try {
      const poolStatus = this.db.getPoolStatus();
      
      if (poolStatus.waitingCount > 5) {
        warnings.push(`High number of waiting connections: ${poolStatus.waitingCount}`);
      }
      
      if (poolStatus.idleCount === 0 && poolStatus.totalCount > 0) {
        warnings.push('No idle connections available');
      }
      
      if (poolStatus.totalCount === 0) {
        warnings.push('No database connections established');
      }
      
      const utilizationRate = (poolStatus.totalCount - poolStatus.idleCount) / poolStatus.totalCount;
      if (utilizationRate > 0.8) {
        warnings.push(`High connection utilization: ${Math.round(utilizationRate * 100)}%`);
      }
      
      if (this.slowQueryCount > this.queryCount * 0.1) {
        warnings.push(`High number of slow queries: ${this.slowQueryCount}/${this.queryCount}`);
      }
      
    } catch (error) {
      warnings.push('Failed to analyze connection pool');
    }
    
    return warnings;
  }

  /**
   * Reset query statistics
   */
  resetStats(): void {
    this.queryCount = 0;
    this.totalQueryTime = 0;
    this.slowQueryCount = 0;
    this.startTime = new Date();
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        const warnings = await this.getPoolWarnings();
        
        if (warnings.length > 0) {
          console.warn('Database Pool Warnings:', warnings);
        }
        
        if (!metrics.health.isHealthy) {
          console.error('Database health check failed');
        }
        
        // Log metrics in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Database Metrics:', {
            connections: metrics.connectionPool,
            queries: metrics.queryStats,
            health: metrics.health.isHealthy
          });
        }
      } catch (error) {
        console.error('Database monitoring error:', error);
      }
    }, intervalMs);
  }
}