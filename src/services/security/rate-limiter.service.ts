import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { User } from '../../models/user.model';
import { DEFAULT_RATE_LIMITS, ErrorCode, HttpStatus } from '../../models/constants';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string | object;
  handler?: (req: Request, res: Response) => void;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export interface UserRateLimitInfo {
  userId: string;
  subscription: string;
  requestsPerMinute: number;
  requestsRemaining: number;
  resetTime: Date;
}

export class RateLimiterService {
  private memoryStore: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Create global rate limiter for all endpoints
   */
  public createGlobalRateLimit(config?: Partial<RateLimitConfig>) {
    const defaultConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      handler: (req: Request, res: Response) => {
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Too many requests from this IP, please try again later',
            timestamp: new Date().toISOString()
          }
        });
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };

    return rateLimit(defaultConfig);
  }

  /**
   * Create per-user rate limiter middleware
   */
  public createUserRateLimit() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user as User;
        
        if (!user) {
          return next();
        }

        const userId = user.id;
        const userLimits = user.rateLimits;
        const windowMs = 60 * 1000; // 1 minute window
        const maxRequests = userLimits.requestsPerMinute;

        const key = `user:${userId}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get or create rate limit entry
        let entry = this.memoryStore.get(key);
        
        if (!entry || entry.resetTime <= now) {
          // Create new window
          entry = {
            count: 0,
            resetTime: now + windowMs
          };
        }

        // Check if request exceeds limit
        if (entry.count >= maxRequests) {
          const resetTimeSeconds = Math.ceil((entry.resetTime - now) / 1000);
          
          res.set({
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
            'Retry-After': resetTimeSeconds.toString()
          });

          return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
            error: {
              code: ErrorCode.RATE_LIMIT_EXCEEDED,
              message: `Rate limit exceeded. Maximum ${maxRequests} requests per minute allowed for ${user.subscription} subscription`,
              details: {
                limit: maxRequests,
                remaining: 0,
                resetTime: new Date(entry.resetTime).toISOString(),
                retryAfter: resetTimeSeconds
              },
              timestamp: new Date().toISOString()
            }
          });
        }

        // Increment counter and update store
        entry.count++;
        this.memoryStore.set(key, entry);

        // Set rate limit headers
        const remaining = Math.max(0, maxRequests - entry.count);
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': entry.resetTime.toString()
        });

        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        next(); // Continue on error to avoid blocking requests
      }
    };
  }

  /**
   * Create endpoint-specific rate limiter
   */
  public createEndpointRateLimit(endpoint: string, config?: Partial<RateLimitConfig>) {
    const defaultConfig = {
      windowMs: 60 * 1000, // 1 minute
      max: 60, // 60 requests per minute per endpoint
      handler: (req: Request, res: Response) => {
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: `Too many requests to ${endpoint}, please try again later`,
            timestamp: new Date().toISOString()
          }
        });
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        const user = (req as any).user as User;
        return user ? `${user.id}:${endpoint}` : `${req.ip}:${endpoint}`;
      },
      ...config
    };

    return rateLimit(defaultConfig);
  }

  /**
   * Create prediction endpoint rate limiter with user-specific limits
   */
  public createPredictionRateLimit() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user as User;
        const modelId = req.params.modelId;
        
        if (!user || !modelId) {
          return next();
        }

        const key = `prediction:${user.id}:${modelId}`;
        const windowMs = 60 * 1000; // 1 minute window
        const maxRequests = user.subscription === 'premium' 
          ? DEFAULT_RATE_LIMITS.PREMIUM_TIER.requestsPerMinute
          : DEFAULT_RATE_LIMITS.FREE_TIER.requestsPerMinute;

        const now = Date.now();
        let entry = this.memoryStore.get(key);
        
        if (!entry || entry.resetTime <= now) {
          entry = {
            count: 0,
            resetTime: now + windowMs
          };
        }

        if (entry.count >= maxRequests) {
          const resetTimeSeconds = Math.ceil((entry.resetTime - now) / 1000);
          
          res.set({
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
            'Retry-After': resetTimeSeconds.toString()
          });

          return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
            error: {
              code: ErrorCode.RATE_LIMIT_EXCEEDED,
              message: `Prediction rate limit exceeded for model ${modelId}. Maximum ${maxRequests} requests per minute`,
              details: {
                modelId,
                limit: maxRequests,
                remaining: 0,
                resetTime: new Date(entry.resetTime).toISOString(),
                retryAfter: resetTimeSeconds
              },
              timestamp: new Date().toISOString()
            }
          });
        }

        entry.count++;
        this.memoryStore.set(key, entry);

        const remaining = Math.max(0, maxRequests - entry.count);
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': entry.resetTime.toString()
        });

        next();
      } catch (error) {
        console.error('Prediction rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * Get rate limit info for a user
   */
  public getUserRateLimitInfo(userId: string): UserRateLimitInfo | null {
    const key = `user:${userId}`;
    const entry = this.memoryStore.get(key);
    
    if (!entry) {
      return null;
    }

    return {
      userId,
      subscription: 'unknown', // Would need user data to determine this
      requestsPerMinute: 0, // Would need user data
      requestsRemaining: Math.max(0, 0 - entry.count), // Would need user limits
      resetTime: new Date(entry.resetTime)
    };
  }

  /**
   * Reset rate limit for a user (admin function)
   */
  public resetUserRateLimit(userId: string): void {
    const key = `user:${userId}`;
    this.memoryStore.delete(key);
  }

  /**
   * Clean up expired entries from memory store
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.resetTime <= now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.memoryStore.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired rate limit entries`);
    }
  }

  /**
   * Get current memory store stats
   */
  public getStats() {
    return {
      totalEntries: this.memoryStore.size,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.memoryStore.clear();
  }
}