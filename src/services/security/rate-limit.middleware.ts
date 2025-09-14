import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from './rate-limiter.service';
import { User } from '../../models/user.model';
import { ErrorCode, HttpStatus } from '../../models/constants';

export class RateLimitMiddleware {
  private rateLimiterService: RateLimiterService;

  constructor() {
    this.rateLimiterService = new RateLimiterService();
  }

  /**
   * Global rate limiting middleware for all requests
   */
  public globalRateLimit() {
    return this.rateLimiterService.createGlobalRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests per 15 minutes per IP
      handler: (req: Request, res: Response) => {
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Too many requests from this IP address. Please try again later.',
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  }

  /**
   * Authentication endpoint rate limiting
   */
  public authRateLimit() {
    return this.rateLimiterService.createEndpointRateLimit('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 login attempts per 15 minutes
      handler: (req: Request, res: Response) => {
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Too many authentication attempts. Please try again later.',
            details: {
              retryAfter: '15 minutes'
            },
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  }

  /**
   * Upload endpoint rate limiting
   */
  public uploadRateLimit() {
    return this.rateLimiterService.createEndpointRateLimit('upload', {
      windowMs: 60 * 1000, // 1 minute
      max: 5, // 5 uploads per minute
      handler: (req: Request, res: Response) => {
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Upload rate limit exceeded. Please wait before uploading another model.',
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  }

  /**
   * User-specific rate limiting based on subscription
   */
  public userRateLimit() {
    return this.rateLimiterService.createUserRateLimit();
  }

  /**
   * Prediction endpoint rate limiting
   */
  public predictionRateLimit() {
    return this.rateLimiterService.createPredictionRateLimit();
  }

  /**
   * Model management rate limiting
   */
  public modelManagementRateLimit() {
    return this.rateLimiterService.createEndpointRateLimit('models', {
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 requests per minute for model management
      handler: (req: Request, res: Response) => {
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Model management rate limit exceeded. Please try again later.',
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  }

  /**
   * API key management rate limiting
   */
  public apiKeyRateLimit() {
    return this.rateLimiterService.createEndpointRateLimit('api-keys', {
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 requests per minute for API key operations
      handler: (req: Request, res: Response) => {
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'API key management rate limit exceeded. Please try again later.',
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  }

  /**
   * Get rate limit information for current user
   */
  public getRateLimitInfo() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user as User;
        
        if (!user) {
          return res.status(HttpStatus.UNAUTHORIZED).json({
            error: {
              code: ErrorCode.UNAUTHORIZED,
              message: 'Authentication required to view rate limit information',
              timestamp: new Date().toISOString()
            }
          });
        }

        const rateLimitInfo = this.rateLimiterService.getUserRateLimitInfo(user.id);
        
        return res.json({
          userId: user.id,
          subscription: user.subscription,
          rateLimits: user.rateLimits,
          currentUsage: rateLimitInfo || {
            requestsRemaining: user.rateLimits.requestsPerMinute,
            resetTime: new Date(Date.now() + 60000) // Next minute
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting rate limit info:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to retrieve rate limit information',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Reset rate limit for a user (admin only)
   */
  public resetUserRateLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const { userId } = req.params;
        const currentUser = (req as any).user as User;

        // In a real implementation, you'd check if the current user is an admin
        // For now, we'll allow users to reset their own rate limits
        if (currentUser.id !== userId) {
          return res.status(HttpStatus.FORBIDDEN).json({
            error: {
              code: ErrorCode.AUTHORIZATION_ERROR,
              message: 'You can only reset your own rate limits',
              timestamp: new Date().toISOString()
            }
          });
        }

        this.rateLimiterService.resetUserRateLimit(userId);

        return res.json({
          message: 'Rate limit reset successfully',
          userId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error resetting rate limit:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to reset rate limit',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Get rate limiter statistics (admin only)
   */
  public getStats() {
    return (req: Request, res: Response) => {
      try {
        const stats = this.rateLimiterService.getStats();
        
        res.json({
          rateLimiter: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting rate limiter stats:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to retrieve rate limiter statistics',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.rateLimiterService.destroy();
  }
}