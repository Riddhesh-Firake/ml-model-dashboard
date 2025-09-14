import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../auth.middleware';
import { AuthUtils } from '../auth.utils';
import { UserManagementService } from '../user-management.service';
import { ApiKeyService } from '../api-key.service';
import { AuthenticationError } from '../../../models/error.model';

// Mock dependencies
jest.mock('../auth.utils');
jest.mock('../user-management.service');
jest.mock('../api-key.service');

const mockAuthUtils = AuthUtils as jest.Mocked<typeof AuthUtils>;
const mockUserService = {
  getUserById: jest.fn(),
  createUser: jest.fn(),
  authenticateUser: jest.fn(),
  getUserByEmail: jest.fn(),
  getUserByApiKey: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  validateApiKey: jest.fn()
} as jest.Mocked<UserManagementService>;

const mockApiKeyService = {
  validateApiKey: jest.fn(),
  createApiKey: jest.fn(),
  listApiKeys: jest.fn(),
  getApiKey: jest.fn(),
  updateApiKey: jest.fn(),
  deleteApiKey: jest.fn(),
  rotateApiKey: jest.fn(),
  cleanupExpiredKeys: jest.fn()
} as jest.Mocked<ApiKeyService>;

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    authMiddleware = new AuthMiddleware(mockUserService, mockApiKeyService);

    mockRequest = {
      headers: {},
      user: undefined
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('authenticateJWT', () => {
    it('should authenticate valid JWT token', async () => {
      const mockToken = 'valid-jwt-token';
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      };

      mockRequest.headers = {
        authorization: `Bearer ${mockToken}`
      };

      mockAuthUtils.extractTokenFromHeader.mockReturnValue(mockToken);
      mockAuthUtils.verifyToken.mockReturnValue(mockPayload);
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await authMiddleware.authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthUtils.extractTokenFromHeader).toHaveBeenCalledWith(`Bearer ${mockToken}`);
      expect(mockAuthUtils.verifyToken).toHaveBeenCalledWith(mockToken);
      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when no token provided', async () => {
      mockRequest.headers = {};
      mockAuthUtils.extractTokenFromHeader.mockReturnValue(null);

      await authMiddleware.authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'No token provided',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      const mockToken = 'invalid-token';
      mockRequest.headers = {
        authorization: `Bearer ${mockToken}`
      };

      mockAuthUtils.extractTokenFromHeader.mockReturnValue(mockToken);
      mockAuthUtils.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware.authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user not found', async () => {
      const mockToken = 'valid-token';
      const mockPayload = {
        userId: 'nonexistent-user',
        email: 'test@example.com',
        subscription: 'free'
      };

      mockRequest.headers = {
        authorization: `Bearer ${mockToken}`
      };

      mockAuthUtils.extractTokenFromHeader.mockReturnValue(mockToken);
      mockAuthUtils.verifyToken.mockReturnValue(mockPayload);
      mockUserService.getUserById.mockResolvedValue(null);

      await authMiddleware.authenticateJWT(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'User not found',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authenticateApiKey', () => {
    it('should authenticate valid API key', async () => {
      const mockApiKey = 'valid-api-key';
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'free'
      };

      mockRequest.headers = {
        'x-api-key': mockApiKey
      };

      mockApiKeyService.validateApiKey.mockResolvedValue({
        valid: true,
        userId: 'user-123'
      });
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await authMiddleware.authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith(mockApiKey);
      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'free'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when no API key provided', async () => {
      mockRequest.headers = {};

      await authMiddleware.authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'API_KEY_AUTHENTICATION_FAILED',
          message: 'No API key provided',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when API key is invalid', async () => {
      const mockApiKey = 'invalid-api-key';
      mockRequest.headers = {
        'x-api-key': mockApiKey
      };

      mockApiKeyService.validateApiKey.mockResolvedValue({
        valid: false,
        userId: undefined
      });

      await authMiddleware.authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'API_KEY_AUTHENTICATION_FAILED',
          message: 'Invalid or expired API key',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user associated with API key not found', async () => {
      const mockApiKey = 'valid-api-key';
      mockRequest.headers = {
        'x-api-key': mockApiKey
      };

      mockApiKeyService.validateApiKey.mockResolvedValue({
        valid: true,
        userId: 'nonexistent-user'
      });
      mockUserService.getUserById.mockResolvedValue(null);

      await authMiddleware.authenticateApiKey(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'API_KEY_AUTHENTICATION_FAILED',
          message: 'User associated with API key not found',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authenticateAny', () => {
    it('should use JWT authentication when authorization header is present', async () => {
      const mockToken = 'valid-jwt-token';
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      };

      mockRequest.headers = {
        authorization: `Bearer ${mockToken}`,
        'x-api-key': 'some-api-key' // Should be ignored
      };

      mockAuthUtils.extractTokenFromHeader.mockReturnValue(mockToken);
      mockAuthUtils.verifyToken.mockReturnValue(mockPayload);
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await authMiddleware.authenticateAny(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthUtils.extractTokenFromHeader).toHaveBeenCalled();
      expect(mockApiKeyService.validateApiKey).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use API key authentication when only API key is present', async () => {
      const mockApiKey = 'valid-api-key';
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'free'
      };

      mockRequest.headers = {
        'x-api-key': mockApiKey
      };

      mockApiKeyService.validateApiKey.mockResolvedValue({
        valid: true,
        userId: 'user-123'
      });
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await authMiddleware.authenticateAny(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith(mockApiKey);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when no authentication method provided', async () => {
      mockRequest.headers = {};

      await authMiddleware.authenticateAny(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'NO_AUTHENTICATION',
          message: 'No authentication method provided. Use Bearer token or X-API-Key header',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requirePremium', () => {
    it('should allow access for premium users', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      };

      authMiddleware.requirePremium(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', () => {
      mockRequest.user = undefined;

      authMiddleware.requirePremium(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have premium subscription', () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'free'
      };

      authMiddleware.requirePremium(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'PREMIUM_REQUIRED',
          message: 'Premium subscription required for this feature',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user when valid JWT token is provided', async () => {
      const mockToken = 'valid-jwt-token';
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      };

      mockRequest.headers = {
        authorization: `Bearer ${mockToken}`
      };

      mockAuthUtils.extractTokenFromHeader.mockReturnValue(mockToken);
      mockAuthUtils.verifyToken.mockReturnValue(mockPayload);
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'premium'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set user when valid API key is provided', async () => {
      const mockApiKey = 'valid-api-key';
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'free'
      };

      mockRequest.headers = {
        'x-api-key': mockApiKey
      };

      mockApiKeyService.validateApiKey.mockResolvedValue({
        valid: true,
        userId: 'user-123'
      });
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        subscription: 'free'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user when no authentication provided', async () => {
      mockRequest.headers = {};

      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without user when invalid token provided', async () => {
      const mockToken = 'invalid-token';
      mockRequest.headers = {
        authorization: `Bearer ${mockToken}`
      };

      mockAuthUtils.extractTokenFromHeader.mockReturnValue(mockToken);
      mockAuthUtils.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware.optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});