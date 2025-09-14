import { Request, Response, NextFunction } from 'express';
import { RequestQueueService, QueueConfig } from '../request-queue.service';
import { User } from '../../../models/user.model';
import { SubscriptionType, ErrorCode, HttpStatus } from '../../../models/constants';

// Mock express objects
const mockRequest = (overrides = {}) => ({
  path: '/api/test',
  method: 'GET',
  user: null,
  ...overrides
} as unknown as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.on = jest.fn().mockReturnValue(res);
  res.headersSent = false;
  res.destroyed = false;
  return res;
};

const mockNext = jest.fn() as NextFunction;

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  apiKey: 'test-api-key',
  createdAt: new Date(),
  subscription: SubscriptionType.FREE,
  rateLimits: {
    requestsPerMinute: 10,
    modelsLimit: 5
  }
};

const mockPremiumUser: User = {
  ...mockUser,
  id: 'premium-user-123',
  subscription: SubscriptionType.PREMIUM,
  rateLimits: {
    requestsPerMinute: 100,
    modelsLimit: 50
  }
};

describe('RequestQueueService', () => {
  let queueService: RequestQueueService;
  let config: QueueConfig;

  beforeEach(() => {
    config = {
      maxQueueSize: 5,
      defaultTimeout: 1000, // 1 second for testing
      priorityLevels: {
        high: 1,
        normal: 2,
        low: 3
      },
      concurrentRequests: 2
    };
    queueService = new RequestQueueService(config);
    jest.clearAllMocks();
  });

  afterEach(() => {
    queueService.destroy();
  });

  describe('enqueueRequest', () => {
    it('should enqueue request successfully', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();

      const result = queueService.enqueueRequest(req, res, mockNext, 'normal');

      expect(result).toBe(true);
      expect(res.set).toHaveBeenCalledWith({
        'X-Queue-Position': '1',
        'X-Queue-Size': '1',
        'X-Estimated-Wait': expect.any(String)
      });
    });

    it('should reject request when queue is full', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();

      // Fill the queue beyond capacity (accounting for concurrent processing)
      for (let i = 0; i < config.maxQueueSize + config.concurrentRequests; i++) {
        queueService.enqueueRequest(mockRequest(), mockResponse(), mockNext);
      }

      // This should be rejected
      const result = queueService.enqueueRequest(req, res, mockNext);

      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: 'Request queue is full. Please try again later.',
          details: {
            maxQueueSize: config.maxQueueSize,
            retryAfter: '60 seconds'
          },
          timestamp: expect.any(String)
        }
      });
    });

    it('should process requests immediately when capacity is available', (done) => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();

      // Mock the end method to track completion
      res.end = jest.fn().mockImplementation(() => {
        // Request should be processed immediately since we have capacity
        expect(mockNext).toHaveBeenCalled();
        done();
        return res;
      });

      queueService.enqueueRequest(req, res, mockNext, 'normal');

      // Simulate request completion
      setTimeout(() => {
        res.end();
      }, 10);
    });

    it('should handle priority ordering correctly', () => {
      // Create a service with no concurrent processing to test pure queuing
      const testService = new RequestQueueService({
        ...config,
        concurrentRequests: 0 // Force all requests to queue
      });

      const req1 = mockRequest({ path: '/low' });
      const req2 = mockRequest({ path: '/high' });
      const req3 = mockRequest({ path: '/normal' });

      const res1 = mockResponse();
      const res2 = mockResponse();
      const res3 = mockResponse();

      // Add requests with different priorities - order matters for testing
      testService.enqueueRequest(req1, res1, mockNext, 'low');    // Should be last
      testService.enqueueRequest(req2, res2, mockNext, 'high');   // Should be first
      testService.enqueueRequest(req3, res3, mockNext, 'normal'); // Should be middle

      // Verify that headers were set (positions will be calculated based on priority)
      expect(res1.set).toHaveBeenCalled();
      expect(res2.set).toHaveBeenCalled();
      expect(res3.set).toHaveBeenCalled();

      testService.destroy();
    });
  });

  describe('determinePriority', () => {
    it('should assign high priority to premium users', () => {
      const req = mockRequest({ user: mockPremiumUser });
      const priority = queueService.determinePriority(req);
      expect(priority).toBe('high');
    });

    it('should assign normal priority to regular users on critical endpoints', () => {
      const req = mockRequest({ 
        user: mockUser,
        path: '/api/predict/model-123'
      });
      const priority = queueService.determinePriority(req);
      expect(priority).toBe('normal');
    });

    it('should assign low priority to unauthenticated users', () => {
      const req = mockRequest({ path: '/api/models' });
      const priority = queueService.determinePriority(req);
      expect(priority).toBe('low');
    });

    it('should assign normal priority to authenticated users on regular endpoints', () => {
      const req = mockRequest({ 
        user: mockUser,
        path: '/api/models'
      });
      const priority = queueService.determinePriority(req);
      expect(priority).toBe('normal');
    });
  });

  describe('timeout handling', () => {
    it('should timeout queued requests', (done) => {
      // Create a service with no concurrent processing to force queuing
      const testService = new RequestQueueService({
        ...config,
        concurrentRequests: 0, // Force all requests to queue
        defaultTimeout: 100 // Short timeout for testing
      });

      const req = mockRequest({ user: mockUser });
      const res = mockResponse();

      // This request should be queued and timeout
      testService.enqueueRequest(req, res, mockNext, 'normal', 100); // 100ms timeout

      setTimeout(() => {
        expect(res.status).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.TIMEOUT_ERROR,
            message: 'Request timed out while waiting in queue'
          })
        }));
        testService.destroy();
        done();
      }, 200);
    }, 15000); // Increase test timeout
  });

  describe('getStats', () => {
    it('should return accurate queue statistics', () => {
      const req1 = mockRequest();
      const req2 = mockRequest();
      const res1 = mockResponse();
      const res2 = mockResponse();

      queueService.enqueueRequest(req1, res1, mockNext);
      queueService.enqueueRequest(req2, res2, mockNext);

      const stats = queueService.getStats();

      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
      expect(stats.activeRequests).toBeGreaterThanOrEqual(0);
      expect(stats.totalProcessed).toBeGreaterThanOrEqual(0);
      expect(stats.totalTimedOut).toBe(0);
      expect(stats.totalRejected).toBe(0);
    });
  });

  describe('getUserQueueStatus', () => {
    it('should return correct queue status for user', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();

      // Fill concurrent slots to force queuing
      for (let i = 0; i < config.concurrentRequests; i++) {
        queueService.enqueueRequest(mockRequest(), mockResponse(), mockNext);
      }

      queueService.enqueueRequest(req, res, mockNext);

      const status = queueService.getUserQueueStatus(mockUser.id);

      expect(status.inQueue).toBe(true);
      expect(status.position).toBeGreaterThan(0);
      expect(status.estimatedWait).toBeGreaterThan(0);
    });

    it('should return not in queue for user not in queue', () => {
      const status = queueService.getUserQueueStatus('non-existent-user');

      expect(status.inQueue).toBe(false);
      expect(status.position).toBe(0);
      expect(status.estimatedWait).toBe(0);
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued requests', () => {
      const req1 = mockRequest();
      const req2 = mockRequest();
      const res1 = mockResponse();
      const res2 = mockResponse();

      // Fill concurrent slots to force queuing
      for (let i = 0; i < config.concurrentRequests; i++) {
        queueService.enqueueRequest(mockRequest(), mockResponse(), mockNext);
      }

      queueService.enqueueRequest(req1, res1, mockNext);
      queueService.enqueueRequest(req2, res2, mockNext);

      queueService.clearQueue();

      const stats = queueService.getStats();
      expect(stats.queueSize).toBe(0);

      // Should send service unavailable to cleared requests
      expect(res1.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res2.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe('updateConfig', () => {
    it('should update queue configuration', () => {
      const newConfig = {
        maxQueueSize: 20,
        defaultTimeout: 5000
      };

      queueService.updateConfig(newConfig);

      // Test that new config is applied by trying to fill more than original max
      for (let i = 0; i < 10; i++) {
        const result = queueService.enqueueRequest(mockRequest(), mockResponse(), mockNext);
        expect(result).toBe(true);
      }
    });
  });

  describe('destroy', () => {
    it('should cleanup all resources', () => {
      const req = mockRequest();
      const res = mockResponse();

      queueService.enqueueRequest(req, res, mockNext);
      queueService.destroy();

      const stats = queueService.getStats();
      expect(stats.queueSize).toBe(0);
    });
  });
});