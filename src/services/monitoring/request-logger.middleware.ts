import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.service';

// Extend Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

export interface RequestLogContext {
  requestId: string;
  userId?: string;
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
}

class RequestLoggerMiddleware {
  // Main request logging middleware
  logRequests() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Generate unique request ID
      req.requestId = uuidv4();
      req.startTime = Date.now();
      
      // Extract user info if available
      const userId = (req as any).user?.id || (req as any).userId;
      
      const context: RequestLogContext = {
        requestId: req.requestId,
        userId,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent') || 'Unknown',
        method: req.method,
        url: req.originalUrl || req.url
      };
      
      // Log incoming request
      logger.info('Incoming request', {
        ...context,
        body: this.sanitizeBody(req.body),
        query: req.query,
        headers: this.sanitizeHeaders(req.headers)
      });
      
      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const responseTime = Date.now() - (req.startTime || Date.now());
        
        // Log request completion
        logger.logRequest(
          req.method,
          req.originalUrl || req.url,
          res.statusCode,
          responseTime,
          {
            ...context,
            statusCode: res.statusCode,
            responseTime
          }
        );
        
        // Log slow requests
        if (responseTime > 5000) { // 5 seconds
          logger.warn('Slow request detected', {
            ...context,
            responseTime,
            statusCode: res.statusCode
          });
        }
        
        // Call original end method
        originalEnd.call(this, chunk, encoding);
      };
      
      next();
    };
  }
  
  // Error logging middleware
  logErrors() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const context: RequestLogContext = {
        requestId: req.requestId || 'unknown',
        userId: (req as any).user?.id || (req as any).userId,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent') || 'Unknown',
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode
      };
      
      logger.error('Request error', error, context);
      
      // Log security-related errors
      if (this.isSecurityError(error)) {
        logger.security({
          type: 'unauthorized_access',
          severity: 'medium',
          userId: context.userId,
          ip: context.ip,
          userAgent: context.userAgent,
          details: {
            error: error.message,
            endpoint: context.url,
            method: context.method
          }
        }, context);
      }
      
      next(error);
    };
  }
  
  // Authentication event logging
  logAuthEvent(event: 'login' | 'logout' | 'register' | 'auth_failure', userId?: string, details?: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      const context: RequestLogContext = {
        requestId: req.requestId || uuidv4(),
        userId: userId || (req as any).user?.id,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent') || 'Unknown',
        method: req.method,
        url: req.originalUrl || req.url
      };
      
      logger.audit(`AUTH_${event.toUpperCase()}`, {
        event,
        userId: context.userId,
        ip: context.ip,
        userAgent: context.userAgent,
        details
      }, context);
      
      // Log failed authentication as security event
      if (event === 'auth_failure') {
        logger.security({
          type: 'auth_failure',
          severity: 'medium',
          userId: context.userId,
          ip: context.ip,
          userAgent: context.userAgent,
          details: details || {}
        }, context);
      }
      
      next();
    };
  }
  
  // Model operation logging
  logModelOperation(operation: 'upload' | 'delete' | 'predict' | 'update') {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalEnd = res.end;
      
      res.end = function(chunk?: any, encoding?: any) {
        const context: RequestLogContext = {
          requestId: req.requestId || uuidv4(),
          userId: (req as any).user?.id,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'Unknown',
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode
        };
        
        const modelId = req.params.modelId || req.params.id || (req.body && req.body.modelId);
        const success = res.statusCode >= 200 && res.statusCode < 300;
        
        logger.logModelOperation(
          operation,
          modelId || 'unknown',
          success,
          {
            statusCode: res.statusCode,
            responseTime: Date.now() - (req.startTime || Date.now())
          },
          context
        );
        
        originalEnd.call(this, chunk, encoding);
      };
      
      next();
    };
  }
  
  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
  
  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
  
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
  
  private isSecurityError(error: Error): boolean {
    const securityKeywords = [
      'unauthorized',
      'forbidden',
      'authentication',
      'permission',
      'access denied',
      'invalid token',
      'malicious'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return securityKeywords.some(keyword => errorMessage.includes(keyword));
  }
}

export const requestLogger = new RequestLoggerMiddleware();