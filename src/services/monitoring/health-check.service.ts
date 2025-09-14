import { Request, Response } from 'express';
import { logger } from './logger.service';
import { performanceMonitor } from './performance-monitor.service';
import { databaseManager } from '../../database/database.manager';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      responseTime?: number;
      details?: any;
    };
  };
}

export interface SystemHealth {
  memory: {
    used: number;
    total: number;
    percentage: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  cpu: {
    loadAverage: number[];
    usage: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  database: {
    connected: boolean;
    responseTime: number;
    status: 'healthy' | 'warning' | 'critical';
  };
}

class HealthCheckService {
  private version: string;
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
    this.version = process.env.npm_package_version || '1.0.0';
  }

  // Main health check endpoint
  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Database health check
      const dbCheck = await this.checkDatabase();
      checks.database = dbCheck;
      if (dbCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (dbCheck.status === 'warn') overallStatus = 'degraded';

      // Memory health check
      const memoryCheck = await this.checkMemory();
      checks.memory = memoryCheck;
      if (memoryCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (memoryCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

      // Disk space health check
      const diskCheck = await this.checkDiskSpace();
      checks.disk = diskCheck;
      if (diskCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (diskCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

      // File system health check
      const fsCheck = await this.checkFileSystem();
      checks.filesystem = fsCheck;
      if (fsCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (fsCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

      // External dependencies check
      const depsCheck = await this.checkExternalDependencies();
      checks.dependencies = depsCheck;
      if (depsCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (depsCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

    } catch (error) {
      logger.error('Health check failed', error as Error);
      overallStatus = 'unhealthy';
      checks.error = {
        status: 'fail',
        message: 'Health check execution failed',
        details: { error: (error as Error).message }
      };
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      version: this.version,
      checks
    };

    // Log health status if not healthy
    if (overallStatus !== 'healthy') {
      logger.warn('System health check failed', { healthStatus });
    }

    return healthStatus;
  }

  // Detailed system health
  async getSystemHealth(): Promise<SystemHealth> {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = (usedMem / totalMem) * 100;

    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const cpuUsage = (loadAvg[0] / cpuCount) * 100;

    // Database health
    const dbHealth = await this.checkDatabase();
    
    return {
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: memPercentage,
        status: memPercentage > 90 ? 'critical' : memPercentage > 80 ? 'warning' : 'healthy'
      },
      cpu: {
        loadAverage: loadAvg,
        usage: cpuUsage,
        status: cpuUsage > 90 ? 'critical' : cpuUsage > 80 ? 'warning' : 'healthy'
      },
      disk: {
        used: 0, // Would need platform-specific implementation
        total: 0,
        percentage: 0,
        status: 'healthy'
      },
      database: {
        connected: dbHealth.status === 'pass',
        responseTime: dbHealth.responseTime || 0,
        status: dbHealth.status === 'pass' ? 'healthy' : 'critical'
      }
    };
  }

  // Liveness probe - basic check that service is running
  async getLivenessStatus(): Promise<{ status: 'alive' | 'dead'; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString()
    };
  }

  // Readiness probe - check if service is ready to handle requests
  async getReadinessStatus(): Promise<{ status: 'ready' | 'not_ready'; timestamp: string; checks: any }> {
    const checks: any = {};
    let ready = true;

    try {
      // Check database connectivity
      const dbCheck = await this.checkDatabase();
      checks.database = dbCheck;
      if (dbCheck.status === 'fail') ready = false;

      // Check critical file system paths
      const fsCheck = await this.checkFileSystem();
      checks.filesystem = fsCheck;
      if (fsCheck.status === 'fail') ready = false;

    } catch (error) {
      ready = false;
      checks.error = { status: 'fail', message: (error as Error).message };
    }

    return {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks
    };
  }

  // Express middleware for health endpoints
  healthEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        const health = await this.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        logger.error('Health endpoint error', error as Error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed'
        });
      }
    };
  }

  livenessEndpoint() {
    return async (req: Request, res: Response) => {
      const liveness = await this.getLivenessStatus();
      res.status(200).json(liveness);
    };
  }

  readinessEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        const readiness = await this.getReadinessStatus();
        const statusCode = readiness.status === 'ready' ? 200 : 503;
        res.status(statusCode).json(readiness);
      } catch (error) {
        logger.error('Readiness endpoint error', error as Error);
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          error: 'Readiness check failed'
        });
      }
    };
  }

  metricsEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        const metrics = await performanceMonitor.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.status(200).send(metrics);
      } catch (error) {
        logger.error('Metrics endpoint error', error as Error);
        res.status(500).json({ error: 'Failed to retrieve metrics' });
      }
    };
  }

  private async checkDatabase(): Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      // Test database connection
      await databaseManager.testConnection();
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 5000) {
        return {
          status: 'warn',
          message: 'Database responding slowly',
          responseTime
        };
      }
      
      return {
        status: 'pass',
        message: 'Database connection healthy',
        responseTime
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Database connection failed: ${(error as Error).message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkMemory(): Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; details?: any }> {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedPercentage = ((totalMem - freeMem) / totalMem) * 100;
    const heapUsedPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    const details = {
      systemMemoryUsed: usedPercentage,
      heapMemoryUsed: heapUsedPercentage,
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed
    };

    if (usedPercentage > 95 || heapUsedPercentage > 95) {
      return {
        status: 'fail',
        message: 'Critical memory usage',
        details
      };
    }

    if (usedPercentage > 85 || heapUsedPercentage > 85) {
      return {
        status: 'warn',
        message: 'High memory usage',
        details
      };
    }

    return {
      status: 'pass',
      message: 'Memory usage normal',
      details
    };
  }

  private async checkDiskSpace(): Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; details?: any }> {
    try {
      // Check uploads directory space (simplified check)
      const uploadsPath = path.join(process.cwd(), 'uploads');
      const logsPath = path.join(process.cwd(), 'logs');
      
      const paths = [uploadsPath, logsPath];
      const details: any = {};
      
      for (const checkPath of paths) {
        try {
          await fs.access(checkPath);
          // In a real implementation, you'd check actual disk space
          // For now, we'll just verify the directories are accessible
          details[checkPath] = 'accessible';
        } catch (error) {
          details[checkPath] = 'not_accessible';
        }
      }

      return {
        status: 'pass',
        message: 'Disk space check completed',
        details
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Disk space check failed: ${(error as Error).message}`
      };
    }
  }

  private async checkFileSystem(): Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; details?: any }> {
    try {
      const criticalPaths = [
        path.join(process.cwd(), 'uploads'),
        path.join(process.cwd(), 'logs'),
        path.join(process.cwd(), 'logs', 'audit'),
        path.join(process.cwd(), 'logs', 'security')
      ];

      const results: any = {};
      let hasFailures = false;

      for (const checkPath of criticalPaths) {
        try {
          await fs.access(checkPath, fs.constants.R_OK | fs.constants.W_OK);
          results[checkPath] = 'accessible';
        } catch (error) {
          try {
            // Try to create the directory if it doesn't exist
            await fs.mkdir(checkPath, { recursive: true });
            results[checkPath] = 'created';
          } catch (createError) {
            results[checkPath] = 'failed';
            hasFailures = true;
          }
        }
      }

      return {
        status: hasFailures ? 'fail' : 'pass',
        message: hasFailures ? 'Some critical paths are not accessible' : 'All critical paths accessible',
        details: results
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `File system check failed: ${(error as Error).message}`
      };
    }
  }

  private async checkExternalDependencies(): Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; details?: any }> {
    // In a real implementation, you might check external APIs, services, etc.
    // For now, we'll just return a pass status
    return {
      status: 'pass',
      message: 'No external dependencies to check',
      details: {}
    };
  }
}

export const healthCheck = new HealthCheckService();