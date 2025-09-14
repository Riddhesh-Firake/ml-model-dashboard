import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/user.model';
import { ErrorCode, HttpStatus, SubscriptionType } from '../../models/constants';

export interface QueuedRequest {
  id: string;
  req: Request;
  res: Response;
  next: NextFunction;
  priority: number;
  timestamp: number;
  timeout: NodeJS.Timeout;
  userId?: string;
  endpoint: string;
}

export interface QueueConfig {
  maxQueueSize: number;
  defaultTimeout: number;
  priorityLevels: {
    high: number;
    normal: number;
    low: number;
  };
  concurrentRequests: number;
}

export interface QueueStats {
  queueSize: number;
  activeRequests: number;
  totalProcessed: number;
  totalTimedOut: number;
  totalRejected: number;
  averageWaitTime: number;
}

export class RequestQueueService {
  private queue: QueuedRequest[] = [];
  private activeRequests: Set<string> = new Set();
  private config: QueueConfig;
  private stats: QueueStats = {
    queueSize: 0,
    activeRequests: 0,
    totalProcessed: 0,
    totalTimedOut: 0,
    totalRejected: 0,
    averageWaitTime: 0
  };
  private waitTimes: number[] = [];
  private requestIdCounter = 0;

  constructor(config?: Partial<QueueConfig>) {
    this.config = {
      maxQueueSize: 100,
      defaultTimeout: 30000, // 30 seconds
      priorityLevels: {
        high: 1,
        normal: 2,
        low: 3
      },
      concurrentRequests: 10,
      ...config
    };
  }

  /**
   * Add request to queue with priority handling
   */
  public enqueueRequest(
    req: Request,
    res: Response,
    next: NextFunction,
    priority: 'high' | 'normal' | 'low' = 'normal',
    timeout?: number
  ): boolean {
    // Check if queue is full
    if (this.queue.length >= this.config.maxQueueSize) {
      this.stats.totalRejected++;
      this.sendQueueFullResponse(res);
      return false;
    }

    const user = (req as any).user as User;
    const requestId = this.generateRequestId();
    const requestTimeout = timeout || this.config.defaultTimeout;
    
    // Create timeout handler
    const timeoutHandler = setTimeout(() => {
      this.handleTimeout(requestId);
    }, requestTimeout);

    const queuedRequest: QueuedRequest = {
      id: requestId,
      req,
      res,
      next,
      priority: this.config.priorityLevels[priority],
      timestamp: Date.now(),
      timeout: timeoutHandler,
      userId: user?.id,
      endpoint: req.path
    };

    // Insert request in priority order
    this.insertByPriority(queuedRequest);
    this.stats.queueSize = this.queue.length;

    // Set queue position headers
    const position = this.queue.findIndex(r => r.id === requestId) + 1;
    res.set({
      'X-Queue-Position': position.toString(),
      'X-Queue-Size': this.queue.length.toString(),
      'X-Estimated-Wait': this.estimateWaitTime(position).toString()
    });

    // Try to process queue
    this.processQueue();

    return true;
  }

  /**
   * Process queued requests based on available capacity
   */
  private processQueue(): void {
    while (
      this.queue.length > 0 && 
      this.activeRequests.size < this.config.concurrentRequests
    ) {
      const queuedRequest = this.queue.shift();
      if (!queuedRequest) break;

      // Clear timeout
      clearTimeout(queuedRequest.timeout);

      // Check if response is still writable
      if (queuedRequest.res.headersSent || queuedRequest.res.destroyed) {
        continue;
      }

      // Mark as active
      this.activeRequests.add(queuedRequest.id);
      this.stats.activeRequests = this.activeRequests.size;
      this.stats.queueSize = this.queue.length;

      // Calculate wait time
      const waitTime = Date.now() - queuedRequest.timestamp;
      this.recordWaitTime(waitTime);

      // Set processing headers
      queuedRequest.res.set({
        'X-Queue-Wait-Time': waitTime.toString(),
        'X-Processing-Started': new Date().toISOString()
      });

      // Process the request
      this.processRequest(queuedRequest);
    }
  }

  /**
   * Process individual request
   */
  private processRequest(queuedRequest: QueuedRequest): void {
    try {
      // Wrap the response end method to track completion
      const originalEnd = queuedRequest.res.end.bind(queuedRequest.res);
      queuedRequest.res.end = ((...args: any[]) => {
        this.completeRequest(queuedRequest.id);
        return (originalEnd as any)(...args);
      }) as any;

      // Wrap the response error handling
      queuedRequest.res.on('error', () => {
        this.completeRequest(queuedRequest.id);
      });

      // Continue with the request processing
      queuedRequest.next();
    } catch (error) {
      console.error(`Error processing queued request ${queuedRequest.id}:`, error);
      this.completeRequest(queuedRequest.id);
      
      if (!queuedRequest.res.headersSent) {
        queuedRequest.res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Request processing failed',
            timestamp: new Date().toISOString()
          }
        });
      }
    }
  }

  /**
   * Complete request and continue processing queue
   */
  private completeRequest(requestId: string): void {
    this.activeRequests.delete(requestId);
    this.stats.activeRequests = this.activeRequests.size;
    this.stats.totalProcessed++;

    // Continue processing queue
    setImmediate(() => this.processQueue());
  }

  /**
   * Handle request timeout
   */
  private handleTimeout(requestId: string): void {
    const queuedRequestIndex = this.queue.findIndex(r => r.id === requestId);
    
    if (queuedRequestIndex !== -1) {
      const queuedRequest = this.queue.splice(queuedRequestIndex, 1)[0];
      if (queuedRequest) {
        this.stats.queueSize = this.queue.length;
        this.stats.totalTimedOut++;

        if (!queuedRequest.res.headersSent) {
          queuedRequest.res.status(HttpStatus.GATEWAY_TIMEOUT).json({
            error: {
              code: ErrorCode.TIMEOUT_ERROR,
              message: 'Request timed out while waiting in queue',
              details: {
                queueWaitTime: Date.now() - queuedRequest.timestamp,
                timeout: this.config.defaultTimeout
              },
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    }
  }

  /**
   * Insert request in queue based on priority
   */
  private insertByPriority(queuedRequest: QueuedRequest): void {
    let insertIndex = this.queue.length;

    // Find insertion point based on priority
    for (let i = 0; i < this.queue.length; i++) {
      const currentRequest = this.queue[i];
      if (currentRequest && currentRequest.priority > queuedRequest.priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, queuedRequest);
  }

  /**
   * Determine request priority based on user and endpoint
   */
  public determinePriority(req: Request): 'high' | 'normal' | 'low' {
    const user = (req as any).user as User;
    const endpoint = req.path;

    // Premium users get higher priority
    if (user?.subscription === SubscriptionType.PREMIUM) {
      return 'high';
    }

    // Critical endpoints get higher priority
    if (endpoint.includes('/predict/') || endpoint.includes('/upload')) {
      return user ? 'normal' : 'low';
    }

    // Default priority
    return user ? 'normal' : 'low';
  }

  /**
   * Estimate wait time based on queue position
   */
  private estimateWaitTime(position: number): number {
    if (this.waitTimes.length === 0) {
      return position * 1000; // Default 1 second per position
    }

    const averageProcessingTime = this.stats.averageWaitTime || 1000;
    const availableSlots = Math.max(1, this.config.concurrentRequests - this.activeRequests.size);
    
    return Math.ceil(position / availableSlots) * averageProcessingTime;
  }

  /**
   * Record wait time for statistics
   */
  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    
    // Keep only last 100 wait times for rolling average
    if (this.waitTimes.length > 100) {
      this.waitTimes.shift();
    }

    this.stats.averageWaitTime = this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
  }

  /**
   * Send queue full response
   */
  private sendQueueFullResponse(res: Response): void {
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      error: {
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'Request queue is full. Please try again later.',
        details: {
          maxQueueSize: this.config.maxQueueSize,
          retryAfter: '60 seconds'
        },
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      activeRequests: this.activeRequests.size
    };
  }

  /**
   * Get queue status for a specific user
   */
  public getUserQueueStatus(userId: string): {
    position: number;
    estimatedWait: number;
    inQueue: boolean;
  } {
    const userRequestIndex = this.queue.findIndex(r => r.userId === userId);
    
    if (userRequestIndex === -1) {
      return {
        position: 0,
        estimatedWait: 0,
        inQueue: false
      };
    }

    const position = userRequestIndex + 1;
    return {
      position,
      estimatedWait: this.estimateWaitTime(position),
      inQueue: true
    };
  }

  /**
   * Clear queue (emergency function)
   */
  public clearQueue(): void {
    // Send service unavailable to all queued requests
    this.queue.forEach(queuedRequest => {
      clearTimeout(queuedRequest.timeout);
      
      if (!queuedRequest.res.headersSent) {
        queuedRequest.res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          error: {
            code: ErrorCode.SERVICE_UNAVAILABLE,
            message: 'Service temporarily unavailable. Queue has been cleared.',
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    this.queue = [];
    this.stats.queueSize = 0;
    this.stats.totalRejected += this.queue.length;
  }

  /**
   * Update queue configuration
   */
  public updateConfig(newConfig: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    // Clear all timeouts
    this.queue.forEach(queuedRequest => {
      clearTimeout(queuedRequest.timeout);
    });

    this.clearQueue();
    this.activeRequests.clear();
  }
}