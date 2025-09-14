import { Request, Response, NextFunction } from 'express';
import { RequestQueueMiddleware } from '../request-queue.middleware';
import { User } from '../../../models/user.model';
import { SubscriptionType, ErrorCode, HttpStatus } from '../../../models/constants';

// Mock the RequestQueueService
jest.mock('../request-queue.service', () => {
  return {
    RequestQueueService: jest.fn().mockImplementation(() => ({
      enqueueRequest: jest.fn().mockReturnValue(true),
      determinePriority: jest.fn().mockReturnValue('normal'),
      getStats: jest.fn().mockReturnValue({
        queueSize: 5,
        activeRequests: 2,
        averageWaitTime: 1000,
        totalProcessed: 100,
        totalTimedOut: 2,
        totalRejected: 1
      }),
      getUserQueueStatus: jest.fn().mockReturnValue({
        position: 3,
        estimatedWait: 3000,
        inQueue: true
      }),
      clearQueue: jest.fn(),
      updateConfig: jest.fn(),
      destroy: jest.fn()
    }))
  };
});

const mockRequest = (overrides = {}) => ({
  path: '/api/test',
  method: 'GET',
  body: {},
  user: null,
  ...overrides
} as unknown as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
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

describe('RequestQueueMiddleware', () => {
  let queueMiddleware: RequestQueueMiddleware;

  beforeEach(() => {
    queueMiddleware = new RequestQueueMiddleware({
      maxQueueSize: 10,
      defaultTimeout: 30000,
      concurrentRequests: 5
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queueMiddleware.destroy();
  });

  describe('queueRequests', () => {
    it('should enqueue request successfully', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = queueMiddleware.queueRequests();

      middleware(req, res, mockNext);

      const queueService = queueMiddleware.getQueueService();
      expect(queueService.enqueueRequest).toHaveBeenCalledWith(
        req,
        res,
        mockNext,
        'normal',
        undefined
      );
    });

    it('should skip queue when skipQueue function returns true', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = queueMiddleware.queueRequests({
        skipQueue: () => true
      });

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const queueService = queueMiddleware.getQueueService();
      expect(queueService.enqueueRequest).not.toHaveBeenCalled();
    });

    it('should use custom priority when specified', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = queueMiddleware.queueRequests({
        priority: 'high',
        timeout: 60000
      });

      middleware(req, res, mockNext);

      const queueService = queueMiddleware.getQueueService();
      expect(queueService.enqueueRequest).toHaveBeenCalledWith(
        req,
        res,
        mockNext,
        'high',
        60000
      );
    });

    it('should handle errors gracefully', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      
      // Mock enqueueRequest to throw an error
      const queueService = queueMiddleware.getQueueService();
      (queueService.enqueueRequest as jest.Mock).mockImplementation(() => {
        throw new Error('Queue error');
      });

      const middleware = queueMiddleware.queueRequests();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      middleware(req, res, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith('Error in request queue middleware:', expect.any(Error));
      expect(mockNext).toHaveBeenCalled(); // Should fall back to immediate processing
      
      consoleSpy.mockRestore();
    });
  });

  describe('predictionQueue', () => {
    it('should create prediction queue middleware', () => {
      const middleware = queueMiddleware.predictionQueue();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should skip queue for premium users when queue is small', () => {
      const req = mockRequest({ user: mockPremiumUser });
      const res = mockResponse();
      
      // Mock small queue size
      const queueService = queueMiddleware.getQueueService();
      (queueService.getStats as jest.Mock).mockReturnValue({
        queueSize: 3,
        activeRequests: 1
      });

      const middleware = queueMiddleware.predictionQueue();
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(queueService.enqueueRequest).not.toHaveBeenCalled();
    });
  });

  describe('uploadQueue', () => {
    it('should create upload queue middleware', () => {
      const middleware = queueMiddleware.uploadQueue();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should never skip upload queue', () => {
      const req = mockRequest({ user: mockPremiumUser });
      const res = mockResponse();
      const middleware = queueMiddleware.uploadQueue();

      middleware(req, res, mockNext);

      const queueService = queueMiddleware.getQueueService();
      expect(queueService.enqueueRequest).toHaveBeenCalled();
    });
  });

  describe('modelManagementQueue', () => {
    it('should create model management queue middleware', () => {
      const middleware = queueMiddleware.modelManagementQueue();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should skip queue for GET requests', () => {
      const req = mockRequest({ 
        user: mockUser,
        method: 'GET'
      });
      const res = mockResponse();
      const middleware = queueMiddleware.modelManagementQueue();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const queueService = queueMiddleware.getQueueService();
      expect(queueService.enqueueRequest).not.toHaveBeenCalled();
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status for authenticated user', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = queueMiddleware.getQueueStatus();

      middleware(req, res);

      expect(res.json).toHaveBeenCalledWith({
        queue: {
          size: 5,
          activeRequests: 2,
          averageWaitTime: 1000,
          totalProcessed: 100,
          totalTimedOut: 2,
          totalRejected: 1
        },
        user: {
          position: 3,
          estimatedWait: 3000,
          inQueue: true
        },
        timestamp: expect.any(String)
      });
    });

    it('should return queue status without user info for unauthenticated request', () => {
      const req = mockRequest(); // No user
      const res = mockResponse();
      const middleware = queueMiddleware.getQueueStatus();

      middleware(req, res);

      expect(res.json).toHaveBeenCalledWith({
        queue: expect.any(Object),
        user: null,
        timestamp: expect.any(String)
      });
    });

    it('should handle errors gracefully', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      
      // Mock getStats to throw an error
      const queueService = queueMiddleware.getQueueService();
      (queueService.getStats as jest.Mock).mockImplementation(() => {
        throw new Error('Stats error');
      });

      const middleware = queueMiddleware.getQueueStatus();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      middleware(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve queue status',
          timestamp: expect.any(String)
        }
      });

      consoleSpy.mockRestore();
    });
  });

  describe('clearQueue', () => {
    it('should clear queue for authenticated user', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = queueMiddleware.clearQueue();

      middleware(req, res);

      const queueService = queueMiddleware.getQueueService();
      expect(queueService.clearQueue).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Queue cleared successfully',
        timestamp: expect.any(String)
      });
    });

    it('should require authentication', () => {
      const req = mockRequest(); // No user
      const res = mockResponse();
      const middleware = queueMiddleware.clearQueue();

      middleware(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Authentication required',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle errors gracefully', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      
      // Mock clearQueue to throw an error
      const queueService = queueMiddleware.getQueueService();
      (queueService.clearQueue as jest.Mock).mockImplementation(() => {
        throw new Error('Clear error');
      });

      const middleware = queueMiddleware.clearQueue();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      middleware(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to clear queue',
          timestamp: expect.any(String)
        }
      });

      consoleSpy.mockRestore();
    });
  });

  describe('updateQueueConfig', () => {
    it('should update queue configuration for authenticated user', () => {
      const req = mockRequest({ 
        user: mockUser,
        body: {
          maxQueueSize: 20,
          defaultTimeout: 60000,
          concurrentRequests: 10
        }
      });
      const res = mockResponse();
      const middleware = queueMiddleware.updateQueueConfig();

      middleware(req, res);

      const queueService = queueMiddleware.getQueueService();
      expect(queueService.updateConfig).toHaveBeenCalledWith({
        maxQueueSize: 20,
        defaultTimeout: 60000,
        concurrentRequests: 10
      });
      expect(res.json).toHaveBeenCalledWith({
        message: 'Queue configuration updated successfully',
        config: {
          maxQueueSize: 20,
          defaultTimeout: 60000,
          concurrentRequests: 10
        },
        timestamp: expect.any(String)
      });
    });

    it('should require authentication', () => {
      const req = mockRequest({ body: { maxQueueSize: 20 } });
      const res = mockResponse();
      const middleware = queueMiddleware.updateQueueConfig();

      middleware(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when queue is normal', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // Mock healthy queue stats
      const queueService = queueMiddleware.getQueueService();
      (queueService.getStats as jest.Mock).mockReturnValue({
        queueSize: 10,
        activeRequests: 5,
        averageWaitTime: 1000
      });

      const middleware = queueMiddleware.healthCheck();
      middleware(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith({
        status: 'healthy',
        queue: {
          size: 10,
          activeRequests: 5,
          averageWaitTime: 1000
        },
        timestamp: expect.any(String)
      });
    });

    it('should return degraded status when queue is overloaded', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // Mock overloaded queue stats
      const queueService = queueMiddleware.getQueueService();
      (queueService.getStats as jest.Mock).mockReturnValue({
        queueSize: 60, // Over threshold
        activeRequests: 25, // Over threshold
        averageWaitTime: 5000
      });

      const middleware = queueMiddleware.healthCheck();
      middleware(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.json).toHaveBeenCalledWith({
        status: 'degraded',
        queue: {
          size: 60,
          activeRequests: 25,
          averageWaitTime: 5000
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle errors gracefully', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // Mock getStats to throw an error
      const queueService = queueMiddleware.getQueueService();
      (queueService.getStats as jest.Mock).mockImplementation(() => {
        throw new Error('Health check error');
      });

      const middleware = queueMiddleware.healthCheck();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      middleware(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        error: 'Queue health check failed',
        timestamp: expect.any(String)
      });

      consoleSpy.mockRestore();
    });
  });

  describe('getQueueService', () => {
    it('should return the queue service instance', () => {
      const queueService = queueMiddleware.getQueueService();
      expect(queueService).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      const queueService = queueMiddleware.getQueueService();
      queueMiddleware.destroy();
      expect(queueService.destroy).toHaveBeenCalled();
    });
  });
});