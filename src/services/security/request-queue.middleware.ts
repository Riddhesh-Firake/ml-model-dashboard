import { Request, Response, NextFunction } from 'express';
import { RequestQueueService, QueueConfig } from './request-queue.service';
import { User } from '../../models/user.model';
import { ErrorCode, HttpStatus } from '../../models/constants';

export class RequestQueueMiddleware {
  private queueService: RequestQueueService;

  constructor(config?: Partial<QueueConfig>) {
    this.queueService = new RequestQueueService(config);
  }

  /**
   * Queue middleware for high-load endpoints
   */
  public queueRequests(options?: {
    priority?: 'high' | 'normal' | 'low';
    timeout?: number;
    skipQueue?: (req: Request) => boolean;
  }) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Check if we should skip queuing for this request
        if (options?.skipQueue && options.skipQueue(req)) {
          return next();
        }

        // Determine priority
        const priority = options?.priority || this.queueService.determinePriority(req);
        
        // Try to enqueue the request
        const enqueued = this.queueService.enqueueRequest(
          req,
          res,
          next,
          priority,
          options?.timeout
        );

        // If not enqueued (queue full), response is already sent
        if (!enqueued) {
          return;
        }

        // If enqueued successfully, the request will be processed when capacity is available
        // The next() function will be called by the queue service
      } catch (error) {
        console.error('Error in request queue middleware:', error);
        
        // Fall back to processing immediately on error
        next();
      }
    };
  }

  /**
   * Prediction endpoint queue middleware with high priority for premium users
   */
  public predictionQueue() {
    return this.queueRequests({
      priority: 'normal',
      timeout: 60000, // 60 seconds for predictions
      skipQueue: (req: Request) => {
        const user = (req as any).user as User;
        // Skip queue for premium users if queue is small
        return user?.subscription === 'premium' && this.queueService.getStats().queueSize < 5;
      }
    });
  }

  /**
   * Upload endpoint queue middleware
   */
  public uploadQueue() {
    return this.queueRequests({
      priority: 'normal',
      timeout: 300000, // 5 minutes for uploads
      skipQueue: (req: Request) => {
        // Never skip upload queue due to resource intensity
        return false;
      }
    });
  }

  /**
   * Model management queue middleware
   */
  public modelManagementQueue() {
    return this.queueRequests({
      priority: 'low',
      timeout: 30000, // 30 seconds for model management
      skipQueue: (req: Request) => {
        // Skip queue for simple GET requests
        return req.method === 'GET';
      }
    });
  }

  /**
   * Get queue status endpoint
   */
  public getQueueStatus() {
    return (req: Request, res: Response) => {
      try {
        const user = (req as any).user as User;
        const stats = this.queueService.getStats();
        
        let userStatus = null;
        if (user) {
          userStatus = this.queueService.getUserQueueStatus(user.id);
        }

        return res.json({
          queue: {
            size: stats.queueSize,
            activeRequests: stats.activeRequests,
            averageWaitTime: stats.averageWaitTime,
            totalProcessed: stats.totalProcessed,
            totalTimedOut: stats.totalTimedOut,
            totalRejected: stats.totalRejected
          },
          user: userStatus,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting queue status:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to retrieve queue status',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Clear queue endpoint (admin only)
   */
  public clearQueue() {
    return (req: Request, res: Response) => {
      try {
        // In a real implementation, you'd check admin permissions here
        const user = (req as any).user as User;
        
        if (!user) {
          return res.status(HttpStatus.UNAUTHORIZED).json({
            error: {
              code: ErrorCode.UNAUTHORIZED,
              message: 'Authentication required',
              timestamp: new Date().toISOString()
            }
          });
        }

        this.queueService.clearQueue();

        return res.json({
          message: 'Queue cleared successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error clearing queue:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to clear queue',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Update queue configuration endpoint (admin only)
   */
  public updateQueueConfig() {
    return (req: Request, res: Response) => {
      try {
        const user = (req as any).user as User;
        
        if (!user) {
          return res.status(HttpStatus.UNAUTHORIZED).json({
            error: {
              code: ErrorCode.UNAUTHORIZED,
              message: 'Authentication required',
              timestamp: new Date().toISOString()
            }
          });
        }

        const { maxQueueSize, defaultTimeout, concurrentRequests } = req.body;
        
        const newConfig: Partial<QueueConfig> = {};
        if (maxQueueSize !== undefined) newConfig.maxQueueSize = maxQueueSize;
        if (defaultTimeout !== undefined) newConfig.defaultTimeout = defaultTimeout;
        if (concurrentRequests !== undefined) newConfig.concurrentRequests = concurrentRequests;

        this.queueService.updateConfig(newConfig);

        return res.json({
          message: 'Queue configuration updated successfully',
          config: newConfig,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating queue config:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to update queue configuration',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Health check that includes queue status
   */
  public healthCheck() {
    return (req: Request, res: Response) => {
      try {
        const stats = this.queueService.getStats();
        const isHealthy = stats.queueSize < 50 && stats.activeRequests < 20; // Arbitrary thresholds

        return res.status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
          status: isHealthy ? 'healthy' : 'degraded',
          queue: {
            size: stats.queueSize,
            activeRequests: stats.activeRequests,
            averageWaitTime: stats.averageWaitTime
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error in queue health check:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          status: 'unhealthy',
          error: 'Queue health check failed',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Get the queue service instance
   */
  public getQueueService(): RequestQueueService {
    return this.queueService;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.queueService.destroy();
  }
}