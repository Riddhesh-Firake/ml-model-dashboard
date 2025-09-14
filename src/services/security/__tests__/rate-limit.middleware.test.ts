import { Request, Response, NextFunction } from 'express';
import { RateLimitMiddleware } from '../rate-limit.middleware';
import { User } from '../../../models/user.model';
import { SubscriptionType, DEFAULT_RATE_LIMITS, ErrorCode, HttpStatus } from '../../../models/constants';

// Mock the RateLimiterService
jest.mock('../rate-limiter.service', () => {
  return {
    RateLimiterService: jest.fn().mockImplementation(() => ({
      createGlobalRateLimit: jest.fn().mockReturnValue(jest.fn()),
      createEndpointRateLimit: jest.fn().mockReturnValue(jest.fn()),
      createUserRateLimit: jest.fn().mockReturnValue(jest.fn()),
      createPredictionRateLimit: jest.fn().mockReturnValue(jest.fn()),
      getUserRateLimitInfo: jest.fn().mockReturnValue(null),
      resetUserRateLimit: jest.fn(),
      getStats: jest.fn().mockReturnValue({ totalEntries: 0, memoryUsage: {} }),
      destroy: jest.fn()
    }))
  };
});

const mockRequest = (overrides = {}) => ({
  ip: '127.0.0.1',
  params: {},
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
    requestsPerMinute: DEFAULT_RATE_LIMITS.FREE_TIER.requestsPerMinute,
    modelsLimit: DEFAULT_RATE_LIMITS.FREE_TIER.modelsLimit
  }
};

describe('RateLimitMiddleware', () => {
  let rateLimitMiddleware: RateLimitMiddleware;

  beforeEach(() => {
    rateLimitMiddleware = new RateLimitMiddleware();
    jest.clearAllMocks();
  });

  afterEach(() => {
    rateLimitMiddleware.destroy();
  });

  describe('globalRateLimit', () => {
    it('should create global rate limit middleware', () => {
      const middleware = rateLimitMiddleware.globalRateLimit();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('authRateLimit', () => {
    it('should create auth rate limit middleware', () => {
      const middleware = rateLimitMiddleware.authRateLimit();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('uploadRateLimit', () => {
    it('should create upload rate limit middleware', () => {
      const middleware = rateLimitMiddleware.uploadRateLimit();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('userRateLimit', () => {
    it('should create user rate limit middleware', () => {
      const middleware = rateLimitMiddleware.userRateLimit();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('predictionRateLimit', () => {
    it('should create prediction rate limit middleware', () => {
      const middleware = rateLimitMiddleware.predictionRateLimit();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('modelManagementRateLimit', () => {
    it('should create model management rate limit middleware', () => {
      const middleware = rateLimitMiddleware.modelManagementRateLimit();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('apiKeyRateLimit', () => {
    it('should create API key rate limit middleware', () => {
      const middleware = rateLimitMiddleware.apiKeyRateLimit();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return rate limit info for authenticated user', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = rateLimitMiddleware.getRateLimitInfo();

      middleware(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        userId: mockUser.id,
        subscription: mockUser.subscription,
        rateLimits: mockUser.rateLimits,
        currentUsage: expect.objectContaining({
          requestsRemaining: mockUser.rateLimits.requestsPerMinute,
          resetTime: expect.any(Date)
        }),
        timestamp: expect.any(String)
      });
    });

    it('should return unauthorized for unauthenticated user', () => {
      const req = mockRequest(); // No user
      const res = mockResponse();
      const middleware = rateLimitMiddleware.getRateLimitInfo();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Authentication required to view rate limit information',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle errors gracefully', () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      
      // Mock an error in the service
      const mockGetUserRateLimitInfo = jest.fn().mockImplementation(() => {
        throw new Error('Service error');
      });
      (rateLimitMiddleware as any).rateLimiterService.getUserRateLimitInfo = mockGetUserRateLimitInfo;

      const middleware = rateLimitMiddleware.getRateLimitInfo();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve rate limit information',
          timestamp: expect.any(String)
        }
      });

      consoleSpy.mockRestore();
    });
  });

  describe('resetUserRateLimit', () => {
    it('should reset rate limit for the same user', () => {
      const req = mockRequest({ 
        user: mockUser,
        params: { userId: mockUser.id }
      });
      const res = mockResponse();
      const middleware = rateLimitMiddleware.resetUserRateLimit();

      middleware(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Rate limit reset successfully',
        userId: mockUser.id,
        timestamp: expect.any(String)
      });
    });

    it('should deny reset for different user', () => {
      const req = mockRequest({ 
        user: mockUser,
        params: { userId: 'different-user-id' }
      });
      const res = mockResponse();
      const middleware = rateLimitMiddleware.resetUserRateLimit();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: 'You can only reset your own rate limits',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle errors gracefully', () => {
      const req = mockRequest({ 
        user: mockUser,
        params: { userId: mockUser.id }
      });
      const res = mockResponse();
      
      // Mock an error in the service
      const mockResetUserRateLimit = jest.fn().mockImplementation(() => {
        throw new Error('Service error');
      });
      (rateLimitMiddleware as any).rateLimiterService.resetUserRateLimit = mockResetUserRateLimit;

      const middleware = rateLimitMiddleware.resetUserRateLimit();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to reset rate limit',
          timestamp: expect.any(String)
        }
      });

      consoleSpy.mockRestore();
    });
  });

  describe('getStats', () => {
    it('should return rate limiter statistics', () => {
      const req = mockRequest();
      const res = mockResponse();
      const middleware = rateLimitMiddleware.getStats();

      // Mock the service method
      const mockStats = {
        totalEntries: 5,
        memoryUsage: { rss: 1000, heapUsed: 500 }
      };
      (rateLimitMiddleware as any).rateLimiterService.getStats = jest.fn().mockReturnValue(mockStats);

      middleware(req, res);

      expect(res.json).toHaveBeenCalledWith({
        rateLimiter: mockStats,
        timestamp: expect.any(String)
      });
    });

    it('should handle errors gracefully', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // Mock an error in the service
      const mockGetStats = jest.fn().mockImplementation(() => {
        throw new Error('Service error');
      });
      (rateLimitMiddleware as any).rateLimiterService.getStats = mockGetStats;

      const middleware = rateLimitMiddleware.getStats();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      middleware(req, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve rate limiter statistics',
          timestamp: expect.any(String)
        }
      });

      consoleSpy.mockRestore();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      const mockDestroy = jest.fn();
      (rateLimitMiddleware as any).rateLimiterService.destroy = mockDestroy;

      rateLimitMiddleware.destroy();

      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});