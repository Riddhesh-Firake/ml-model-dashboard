import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from '../rate-limiter.service';
import { User } from '../../../models/user.model';
import { SubscriptionType, DEFAULT_RATE_LIMITS, ErrorCode, HttpStatus } from '../../../models/constants';

// Mock express objects
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

const mockPremiumUser: User = {
  ...mockUser,
  id: 'premium-user-123',
  subscription: SubscriptionType.PREMIUM,
  rateLimits: {
    requestsPerMinute: DEFAULT_RATE_LIMITS.PREMIUM_TIER.requestsPerMinute,
    modelsLimit: DEFAULT_RATE_LIMITS.PREMIUM_TIER.modelsLimit
  }
};

describe('RateLimiterService', () => {
  let rateLimiterService: RateLimiterService;

  beforeEach(() => {
    rateLimiterService = new RateLimiterService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    rateLimiterService.destroy();
  });

  describe('createGlobalRateLimit', () => {
    it('should create a global rate limiter with default config', () => {
      const rateLimiter = rateLimiterService.createGlobalRateLimit();
      expect(rateLimiter).toBeDefined();
      expect(typeof rateLimiter).toBe('function');
    });

    it('should create a global rate limiter with custom config', () => {
      const customConfig = {
        windowMs: 5 * 60 * 1000,
        max: 500
      };
      const rateLimiter = rateLimiterService.createGlobalRateLimit(customConfig);
      expect(rateLimiter).toBeDefined();
    });
  });

  describe('createUserRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = rateLimiterService.createUserRateLimit();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': mockUser.rateLimits.requestsPerMinute.toString(),
        'X-RateLimit-Remaining': (mockUser.rateLimits.requestsPerMinute - 1).toString(),
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should block requests when rate limit is exceeded', async () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = rateLimiterService.createUserRateLimit();

      // Make requests up to the limit
      for (let i = 0; i < mockUser.rateLimits.requestsPerMinute; i++) {
        await middleware(req, res, mockNext);
      }

      // Reset mocks for the final request
      jest.clearAllMocks();

      // This request should be blocked
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: expect.stringContaining('Rate limit exceeded'),
          details: expect.objectContaining({
            limit: mockUser.rateLimits.requestsPerMinute,
            remaining: 0
          }),
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle premium users with higher limits', async () => {
      const req = mockRequest({ user: mockPremiumUser });
      const res = mockResponse();
      const middleware = rateLimiterService.createUserRateLimit();

      await middleware(req, res, mockNext);

      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': mockPremiumUser.rateLimits.requestsPerMinute.toString(),
        'X-RateLimit-Remaining': (mockPremiumUser.rateLimits.requestsPerMinute - 1).toString(),
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should continue without rate limiting when no user is present', async () => {
      const req = mockRequest(); // No user
      const res = mockResponse();
      const middleware = rateLimiterService.createUserRateLimit();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const req = mockRequest({ user: null }); // This might cause an error
      const res = mockResponse();
      const middleware = rateLimiterService.createUserRateLimit();

      // Mock console.error to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should continue on error
      consoleSpy.mockRestore();
    });
  });

  describe('createPredictionRateLimit', () => {
    it('should allow prediction requests within limit', async () => {
      const req = mockRequest({ 
        user: mockUser,
        params: { modelId: 'model-123' }
      });
      const res = mockResponse();
      const middleware = rateLimiterService.createPredictionRateLimit();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': DEFAULT_RATE_LIMITS.FREE_TIER.requestsPerMinute.toString(),
        'X-RateLimit-Remaining': (DEFAULT_RATE_LIMITS.FREE_TIER.requestsPerMinute - 1).toString(),
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should block prediction requests when limit exceeded', async () => {
      const req = mockRequest({ 
        user: mockUser,
        params: { modelId: 'model-123' }
      });
      const res = mockResponse();
      const middleware = rateLimiterService.createPredictionRateLimit();

      // Exhaust the rate limit
      for (let i = 0; i < DEFAULT_RATE_LIMITS.FREE_TIER.requestsPerMinute; i++) {
        await middleware(req, res, mockNext);
      }

      jest.clearAllMocks();

      // This should be blocked
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: expect.stringContaining('Prediction rate limit exceeded'),
          details: expect.objectContaining({
            modelId: 'model-123',
            limit: DEFAULT_RATE_LIMITS.FREE_TIER.requestsPerMinute
          }),
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle premium users with higher prediction limits', async () => {
      const req = mockRequest({ 
        user: mockPremiumUser,
        params: { modelId: 'model-123' }
      });
      const res = mockResponse();
      const middleware = rateLimiterService.createPredictionRateLimit();

      await middleware(req, res, mockNext);

      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': DEFAULT_RATE_LIMITS.PREMIUM_TIER.requestsPerMinute.toString(),
        'X-RateLimit-Remaining': (DEFAULT_RATE_LIMITS.PREMIUM_TIER.requestsPerMinute - 1).toString(),
        'X-RateLimit-Reset': expect.any(String)
      });
    });
  });

  describe('getUserRateLimitInfo', () => {
    it('should return null for non-existent user', () => {
      const info = rateLimiterService.getUserRateLimitInfo('non-existent');
      expect(info).toBeNull();
    });

    it('should return rate limit info after user makes requests', async () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = rateLimiterService.createUserRateLimit();

      // Make a request to create an entry
      await middleware(req, res, mockNext);

      const info = rateLimiterService.getUserRateLimitInfo(mockUser.id);
      expect(info).toBeDefined();
      expect(info?.userId).toBe(mockUser.id);
    });
  });

  describe('resetUserRateLimit', () => {
    it('should reset rate limit for a user', async () => {
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = rateLimiterService.createUserRateLimit();

      // Make requests to create rate limit entry
      await middleware(req, res, mockNext);

      // Reset the rate limit
      rateLimiterService.resetUserRateLimit(mockUser.id);

      // The next request should be allowed as if starting fresh
      jest.clearAllMocks();
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return statistics about the rate limiter', () => {
      const stats = rateLimiterService.getStats();
      
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('memoryUsage');
      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.memoryUsage).toBe('object');
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      // This test is tricky because we need to wait for time to pass
      // We'll test the cleanup method indirectly by checking that old entries are removed
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();
      const middleware = rateLimiterService.createUserRateLimit();

      await middleware(req, res, mockNext);
      
      const initialStats = rateLimiterService.getStats();
      expect(initialStats.totalEntries).toBeGreaterThan(0);

      // Force cleanup by calling the private method through reflection
      // In a real scenario, this would happen automatically after time passes
      (rateLimiterService as any).cleanupExpiredEntries();
      
      // Since entries haven't expired yet, count should be the same
      const afterCleanupStats = rateLimiterService.getStats();
      expect(afterCleanupStats.totalEntries).toBe(initialStats.totalEntries);
    });
  });
});