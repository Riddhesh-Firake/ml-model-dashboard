import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from '../../config/index';

export interface LogContext {
  userId?: string;
  requestId?: string;
  modelId?: string;
  endpoint?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

export interface SecurityEvent {
  type: 'auth_failure' | 'rate_limit_exceeded' | 'malicious_file' | 'unauthorized_access' | 'api_key_misuse' | 'csp_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip?: string;
  userAgent?: string;
  details: any;
}

class LoggerService {
  private logger: winston.Logger;
  private auditLogger: winston.Logger;
  private securityLogger: winston.Logger;

  constructor() {
    this.logger = this.createMainLogger();
    this.auditLogger = this.createAuditLogger();
    this.securityLogger = this.createSecurityLogger();
  }

  private createMainLogger(): winston.Logger {
    const logDir = path.join(process.cwd(), 'logs');
    
    return winston.createLogger({
      level: config.app.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
          });
        })
      ),
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          )
        }),
        
        // File transport with rotation
        new DailyRotateFile({
          filename: path.join(logDir, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          zippedArchive: true
        }),
        
        // Error file transport
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true
        })
      ]
    });
  }

  private createAuditLogger(): winston.Logger {
    const logDir = path.join(process.cwd(), 'logs', 'audit');
    
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: path.join(logDir, 'audit-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '50m',
          maxFiles: '90d',
          zippedArchive: true
        })
      ]
    });
  }

  private createSecurityLogger(): winston.Logger {
    const logDir = path.join(process.cwd(), 'logs', 'security');
    
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: path.join(logDir, 'security-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: '365d',
          zippedArchive: true
        }),
        
        // Also log critical security events to console
        new winston.transports.Console({
          level: 'error',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  // Main application logging methods
  info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, {
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      ...context
    });
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  // Audit logging for business events
  audit(event: string, details: any, context?: LogContext): void {
    this.auditLogger.info('AUDIT_EVENT', {
      event,
      details,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  // Security event logging
  security(event: SecurityEvent, context?: LogContext): void {
    const logData = {
      ...event,
      ...context,
      timestamp: new Date().toISOString()
    };

    this.securityLogger.info('SECURITY_EVENT', logData);
    
    // Also log to main logger for critical events
    if (event.severity === 'critical' || event.severity === 'high') {
      this.logger.error(`Security Event: ${event.type}`, logData);
    }
  }

  // Request logging
  logRequest(method: string, url: string, statusCode: number, responseTime: number, context?: LogContext): void {
    this.logger.info('HTTP_REQUEST', {
      method,
      url,
      statusCode,
      responseTime,
      ...context
    });
  }

  // Model operation logging
  logModelOperation(operation: string, modelId: string, success: boolean, details?: any, context?: LogContext): void {
    this.audit('MODEL_OPERATION', {
      operation,
      modelId,
      success,
      details
    }, context);
  }

  // User operation logging
  logUserOperation(operation: string, userId: string, success: boolean, details?: any, context?: LogContext): void {
    this.audit('USER_OPERATION', {
      operation,
      userId,
      success,
      details
    }, context);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: any, context?: LogContext): void {
    this.logger.info('PERFORMANCE', {
      operation,
      duration,
      metadata,
      ...context
    });
  }
}

export const logger = new LoggerService();