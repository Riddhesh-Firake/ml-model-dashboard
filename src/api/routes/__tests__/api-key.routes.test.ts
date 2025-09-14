import request from 'supertest';
import express from 'express';
import { ApiKeyRoutes } from '../api-key.routes';
import { ApiKeyService } from '../../../services/user-management/api-key.service';
import { AuthMiddleware } from '../../../services/user-management/auth.middleware';
import { ValidationError, NotFoundError, AuthorizationError } from '../../../models/error.model';

// Mock dependencies
jest.mock('../../../services/user-management/api-key.service');
jest.mock('../../../services/user-management/auth.middleware');

describe('ApiKeyRoutes', () => {
  let app: express.Application;
  let mockApiKeyService: jest.Mocked<ApiKeyService>;
  let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    subscription: 'free'
  };

  const mockApiKeyResponse = {
    id: 'key-123',
    name: 'Test API Key',
    key: 'mlapi_newkey123',
    isActive: true,
    createdAt: new Date(),
    expiresAt: undefined,
    lastUsed: undefined
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockApiKeyService = {
      createApiKey: jest.fn(),
      listApiKeys: jest.fn(),
      getApiKey: jest.fn(),
      updateApiKey: jest.fn(),
      rotateApiKey: jest.fn(),
      revokeApiKey: jest.fn(),
      validateApiKey: jest.fn(),
      cleanupExpiredKeys: jest.fn()
    } as any;

    mockAuthMiddleware = {
      authenticateJWT: jest.fn((req, res, next) => {
        req.user = mockUser;
        next();
      })
    } as any;

    const apiKeyRoutes = new ApiKeyRoutes(mockApiKeyService, mockAuthMiddleware);
    app.use('/api/keys', apiKeyRoutes.getRouter());

    // Error handler
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(error.statusCode || 500).json({
        error: {
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    });
  });

  describe('POST /api/keys', () => {
    it('should create API key successfully', async () => {
      mockApiKeyService.createApiKey.mockResolvedValue(mockApiKeyResponse);

      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Test API Key'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('API key created successfully');
      expect(response.body.apiKey).toEqual({
        id: mockApiKeyResponse.id,
        name: mockApiKeyResponse.name,
        key: mockApiKeyResponse.key,
        isActive: mockApiKeyResponse.isActive,
        createdAt: mockApiKeyResponse.createdAt.toISOString(),
        expiresAt: mockApiKeyResponse.expiresAt
      });

      expect(mockApiKeyService.createApiKey).toHaveBeenCalledWith({
        userId: 'user-123',
        name: 'Test API Key',
        expiresAt: undefined
      });
    });

    it('should create API key with expiration date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      mockApiKeyService.createApiKey.mockResolvedValue(mockApiKeyResponse);

      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Test API Key',
          expiresAt: futureDate.toISOString()
        });

      expect(response.status).toBe(201);
      expect(mockApiKeyService.createApiKey).toHaveBeenCalledWith({
        userId: 'user-123',
        name: 'Test API Key',
        expiresAt: futureDate
      });
    });

    it('should return validation error for invalid input', async () => {
      const response = await request(app)
        .post('/api/keys')
        .send({
          name: '', // Invalid: empty name
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for past expiration date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Test API Key',
          expiresAt: pastDate.toISOString()
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      mockApiKeyService.createApiKey.mockRejectedValue(
        new ValidationError('Maximum number of API keys reached')
      );

      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Test API Key'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Maximum number of API keys reached');
    });
  });

  describe('GET /api/keys', () => {
    it('should list API keys successfully', async () => {
      const mockApiKeys = [
        {
          id: 'key-123',
          name: 'Test API Key 1',
          isActive: true,
          createdAt: new Date(),
          expiresAt: undefined,
          lastUsed: undefined
        },
        {
          id: 'key-456',
          name: 'Test API Key 2',
          isActive: false,
          createdAt: new Date(),
          expiresAt: new Date(),
          lastUsed: new Date()
        }
      ];

      mockApiKeyService.listApiKeys.mockResolvedValue(mockApiKeys);

      const response = await request(app)
        .get('/api/keys');

      expect(response.status).toBe(200);
      expect(response.body.apiKeys).toHaveLength(2);
      expect(response.body.apiKeys[0]).toEqual({
        id: mockApiKeys[0]!.id,
        name: mockApiKeys[0]!.name,
        isActive: mockApiKeys[0]!.isActive,
        createdAt: mockApiKeys[0]!.createdAt.toISOString(),
        expiresAt: mockApiKeys[0]!.expiresAt,
        lastUsed: mockApiKeys[0]!.lastUsed
      });

      expect(mockApiKeyService.listApiKeys).toHaveBeenCalledWith('user-123');
    });
  });

  describe('GET /api/keys/:keyId', () => {
    it('should get API key details successfully', async () => {
      const mockApiKey = {
        id: 'key-123',
        name: 'Test API Key',
        isActive: true,
        createdAt: new Date(),
        expiresAt: undefined,
        lastUsed: undefined
      };

      mockApiKeyService.getApiKey.mockResolvedValue(mockApiKey);

      const response = await request(app)
        .get('/api/keys/key-123');

      expect(response.status).toBe(200);
      expect(response.body.apiKey).toEqual({
        id: mockApiKey.id,
        name: mockApiKey.name,
        isActive: mockApiKey.isActive,
        createdAt: mockApiKey.createdAt.toISOString(),
        expiresAt: mockApiKey.expiresAt,
        lastUsed: mockApiKey.lastUsed
      });

      expect(mockApiKeyService.getApiKey).toHaveBeenCalledWith('key-123', 'user-123');
    });

    it('should return 404 for non-existent API key', async () => {
      mockApiKeyService.getApiKey.mockRejectedValue(
        new NotFoundError('API key not found')
      );

      const response = await request(app)
        .get('/api/keys/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe('API key not found');
    });
  });

  describe('PUT /api/keys/:keyId', () => {
    it('should update API key successfully', async () => {
      const updatedApiKey = {
        id: 'key-123',
        name: 'Updated API Key',
        isActive: true,
        createdAt: new Date(),
        expiresAt: undefined,
        lastUsed: undefined
      };

      mockApiKeyService.updateApiKey.mockResolvedValue(updatedApiKey);

      const response = await request(app)
        .put('/api/keys/key-123')
        .send({
          name: 'Updated API Key'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('API key updated successfully');
      expect(response.body.apiKey.name).toBe('Updated API Key');

      expect(mockApiKeyService.updateApiKey).toHaveBeenCalledWith(
        'key-123',
        'user-123',
        {
          name: 'Updated API Key',
          isActive: undefined,
          expiresAt: undefined
        }
      );
    });

    it('should return validation error for empty update', async () => {
      const response = await request(app)
        .put('/api/keys/key-123')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/keys/:keyId/rotate', () => {
    it('should rotate API key successfully', async () => {
      const rotatedApiKey = {
        ...mockApiKeyResponse,
        key: 'mlapi_rotatedkey456'
      };

      mockApiKeyService.rotateApiKey.mockResolvedValue(rotatedApiKey);

      const response = await request(app)
        .post('/api/keys/key-123/rotate');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('API key rotated successfully');
      expect(response.body.apiKey.key).toBe('mlapi_rotatedkey456');

      expect(mockApiKeyService.rotateApiKey).toHaveBeenCalledWith('key-123', 'user-123');
    });

    it('should return 403 for unauthorized access', async () => {
      mockApiKeyService.rotateApiKey.mockRejectedValue(
        new AuthorizationError('Access denied to this API key')
      );

      const response = await request(app)
        .post('/api/keys/key-123/rotate');

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Access denied to this API key');
    });
  });

  describe('DELETE /api/keys/:keyId', () => {
    it('should revoke API key successfully', async () => {
      mockApiKeyService.revokeApiKey.mockResolvedValue();

      const response = await request(app)
        .delete('/api/keys/key-123');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('API key revoked successfully');

      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith('key-123', 'user-123');
    });

    it('should return 404 for non-existent API key', async () => {
      mockApiKeyService.revokeApiKey.mockRejectedValue(
        new NotFoundError('API key not found')
      );

      const response = await request(app)
        .delete('/api/keys/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe('API key not found');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // Mock middleware to not set user
      mockAuthMiddleware.authenticateJWT.mockImplementation((req, res, next) => {
        next();
        return Promise.resolve();
      });

      const endpoints = [
        { method: 'post', path: '/api/keys' },
        { method: 'get', path: '/api/keys' },
        { method: 'get', path: '/api/keys/key-123' },
        { method: 'put', path: '/api/keys/key-123' },
        { method: 'post', path: '/api/keys/key-123/rotate' },
        { method: 'delete', path: '/api/keys/key-123' }
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      }
    });
  });
});