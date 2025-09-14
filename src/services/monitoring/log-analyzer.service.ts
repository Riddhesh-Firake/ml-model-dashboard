import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.service';

export interface LogAnalysisResult {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  topErrors: Array<{ error: string; count: number }>;
  securityEvents: Array<{ type: string; count: number; severity: string }>;
  userActivity: Array<{ userId: string; requestCount: number }>;
}

export interface LogQuery {
  startDate?: Date;
  endDate?: Date;
  level?: string;
  userId?: string;
  endpoint?: string;
  limit?: number;
}

class LogAnalyzerService {
  private logDir = path.join(process.cwd(), 'logs');

  async analyzeApplicationLogs(query: LogQuery = {}): Promise<LogAnalysisResult> {
    try {
      const logFiles = await this.getLogFiles('application');
      const logs = await this.readAndFilterLogs(logFiles, query);
      
      return this.generateAnalysis(logs);
    } catch (error) {
      logger.error('Failed to analyze application logs', error as Error);
      throw error;
    }
  }

  async analyzeSecurityLogs(query: LogQuery = {}): Promise<any[]> {
    try {
      const logFiles = await this.getLogFiles('security/security');
      const logs = await this.readAndFilterLogs(logFiles, query);
      
      return logs.filter(log => log.message === 'SECURITY_EVENT');
    } catch (error) {
      logger.error('Failed to analyze security logs', error as Error);
      throw error;
    }
  }

  async analyzeAuditLogs(query: LogQuery = {}): Promise<any[]> {
    try {
      const logFiles = await this.getLogFiles('audit/audit');
      const logs = await this.readAndFilterLogs(logFiles, query);
      
      return logs.filter(log => log.message === 'AUDIT_EVENT');
    } catch (error) {
      logger.error('Failed to analyze audit logs', error as Error);
      throw error;
    }
  }

  async searchLogs(searchTerm: string, query: LogQuery = {}): Promise<any[]> {
    try {
      const logFiles = await this.getLogFiles('application');
      const logs = await this.readAndFilterLogs(logFiles, query);
      
      return logs.filter(log => 
        JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error) {
      logger.error('Failed to search logs', error as Error);
      throw error;
    }
  }

  async getErrorSummary(hours: number = 24): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));
    
    try {
      const logFiles = await this.getLogFiles('application');
      const logs = await this.readAndFilterLogs(logFiles, { 
        startDate, 
        endDate, 
        level: 'error' 
      });
      
      const errorGroups = new Map<string, number>();
      
      logs.forEach(log => {
        const errorKey = log.error?.message || log.message || 'Unknown error';
        errorGroups.set(errorKey, (errorGroups.get(errorKey) || 0) + 1);
      });
      
      return Array.from(errorGroups.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      logger.error('Failed to get error summary', error as Error);
      throw error;
    }
  }

  private async getLogFiles(prefix: string): Promise<string[]> {
    try {
      const logPath = path.join(this.logDir, prefix.includes('/') ? '' : '');
      const files = await fs.readdir(logPath);
      
      return files
        .filter(file => file.startsWith(prefix.split('/').pop() || prefix) && file.endsWith('.log'))
        .map(file => path.join(logPath, file))
        .sort();
    } catch (error) {
      // Return empty array if log directory doesn't exist yet
      return [];
    }
  }

  private async readAndFilterLogs(logFiles: string[], query: LogQuery): Promise<any[]> {
    const allLogs: any[] = [];
    
    for (const file of logFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const log = JSON.parse(line);
            
            // Apply filters
            if (query.startDate && new Date(log.timestamp) < query.startDate) continue;
            if (query.endDate && new Date(log.timestamp) > query.endDate) continue;
            if (query.level && log.level !== query.level) continue;
            if (query.userId && log.userId !== query.userId) continue;
            if (query.endpoint && log.url !== query.endpoint) continue;
            
            allLogs.push(log);
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      } catch (fileError) {
        logger.warn(`Failed to read log file: ${file}`, { error: fileError });
        continue;
      }
    }
    
    // Apply limit
    if (query.limit) {
      return allLogs.slice(-query.limit);
    }
    
    return allLogs;
  }

  private generateAnalysis(logs: any[]): LogAnalysisResult {
    const requestLogs = logs.filter(log => log.message === 'HTTP_REQUEST');
    const errorLogs = logs.filter(log => log.level === 'error');
    const securityLogs = logs.filter(log => log.message === 'SECURITY_EVENT');
    
    // Calculate metrics
    const totalRequests = requestLogs.length;
    const errorRate = totalRequests > 0 ? (errorLogs.length / totalRequests) * 100 : 0;
    
    const responseTimes = requestLogs
      .filter(log => log.responseTime)
      .map(log => log.responseTime);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    // Top endpoints
    const endpointCounts = new Map<string, number>();
    requestLogs.forEach(log => {
      if (log.url) {
        endpointCounts.set(log.url, (endpointCounts.get(log.url) || 0) + 1);
      }
    });
    const topEndpoints = Array.from(endpointCounts.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Top errors
    const errorCounts = new Map<string, number>();
    errorLogs.forEach(log => {
      const errorKey = log.error?.message || log.message || 'Unknown error';
      errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
    });
    const topErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Security events
    const securityEventCounts = new Map<string, { count: number; severity: string }>();
    securityLogs.forEach(log => {
      if (log.type) {
        const existing = securityEventCounts.get(log.type) || { count: 0, severity: log.severity };
        securityEventCounts.set(log.type, { 
          count: existing.count + 1, 
          severity: log.severity || existing.severity 
        });
      }
    });
    const securityEvents = Array.from(securityEventCounts.entries())
      .map(([type, data]) => ({ type, count: data.count, severity: data.severity }))
      .sort((a, b) => b.count - a.count);
    
    // User activity
    const userCounts = new Map<string, number>();
    requestLogs.forEach(log => {
      if (log.userId) {
        userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
      }
    });
    const userActivity = Array.from(userCounts.entries())
      .map(([userId, requestCount]) => ({ userId, requestCount }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 20);
    
    return {
      totalRequests,
      errorRate,
      averageResponseTime,
      topEndpoints,
      topErrors,
      securityEvents,
      userActivity
    };
  }

  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    try {
      const logDirs = [
        this.logDir,
        path.join(this.logDir, 'audit'),
        path.join(this.logDir, 'security')
      ];
      
      for (const dir of logDirs) {
        try {
          const files = await fs.readdir(dir);
          
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              await fs.unlink(filePath);
              logger.info(`Cleaned up old log file: ${file}`);
            }
          }
        } catch (dirError) {
          // Directory might not exist, skip
          continue;
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old logs', error as Error);
      throw error;
    }
  }
}

export const logAnalyzer = new LogAnalyzerService();