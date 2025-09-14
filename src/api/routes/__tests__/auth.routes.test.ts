import request from 'supertest';
import express from 'express';
import { AuthRoutes } from '../auth.routes';
import { UserManagementService } from '../../../services/user-management/user-management.service';
import { AuthMiddleware } from '../../../services/user-management/auth.middleware';
import { User } from '../../../models/user.model';
import { SubscriptionType } from '../../../models/constants';
import { ValidationError, AuthenticationError, ConflictError } from '../../../models/error.model';

// Mock the services
jest.mock('../../../services/user-management/user-management.service');
jest.mock('../../../services/user-management/auth.middleware');

describe('AuthRoutes', () => {
  let app: express.Application;
  let mockUserService: jest.Mocked<UserManagementService>;
  let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;

  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    apiKey: 'mlapi_test123',
    createdAt: new Date(),
    subscription: SubscriptionType.FREE,
    rateLimits: {
      requestsPerMinute: 10,
      modelsLimit: 5
    }
  };

  beforeEach(() => {
    // Create mocked services
    mockUserService = {
      createUser: jest.fn(),
      authenticateUser: jest.fn(),
      getUserById: jest.fn(),
      updateUser: jest.fn(),
      generateApiKey: jest.fn(),
    } as any;

    mockAuthMiddleware = {
      authenticateAny: jest.fn((req, res, next) => {
        req.user = { userId: mockUser.id, email: mockUser.email, subscription: mockUser.subscription };
        next();
      }),
      authenticateJWT: jest.fn((req, res, next) => {
        req.user = { userId: mockUser.id, email: mockUser.email, subscription: mockUser.subscription };
        next();
      }),
    } as any;

    // Create Express app with routes
    app = express();
    app.use(express.json());
    
    const authRoutes = new AuthRoutes(mockUserService, mockAuthMiddleware);
    app.use('/api/auth', authRoutes.getRouter());

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'StrongPass123!'
    };

    it('should register a user successfully', async () => {
      mockUserService.createUser.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body).toEqual({
        message: 'User registered successfully',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          subscription: mockUser.subscription,
          createdAt: mockUser.createdAt.toISOString(),
          rateLimits: mockUser.rateLimits
        }
      });

      expect(mockUserService.createUser).toHaveBeenCalledWith(validRegistrationData);
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'StrongPass123!'
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid input data');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short'
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com'
          // missing password
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for existing user', async () => {
      mockUserService.createUser.mockRejectedValue(
        new ConflictError('User with this email already exists')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT_ERROR');
      expect(response.body.error.message).toBe('User with this email already exists');
    });

    it('should return 400 for validation error', async () => {
      mockUserService.createUser.mockRejectedValue(
        new ValidationError('Password validation failed', { errors: ['Password too weak'] })
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Password validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'StrongPass123!'
    };

    it('should authenticate user successfully', async () => {
      const authResponse = {
        user: mockUser,
        token: 'jwt-token-123'
      };
      mockUserService.authenticateUser.mockResolvedValue(authResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Authentication successful',
        token: 'jwt-token-123',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          subscription: mockUser.subscription,
          createdAt: mockUser.createdAt.toISOString(),
          rateLimits: mockUser.rateLimits
        }
      });

      expect(mockUserService.authenticateUser).toHaveBeenCalledWith(validLoginData);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password'
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // missing password
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for invalid credentials', async () => {
      mockUserService.authenticateUser.mockRejectedValue(
        new AuthenticationError('Invalid email or password')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile when authenticated', async () => {
      mockUserService.getUserById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        apiKey: mockUser.apiKey,
        subscription: mockUser.subscription,
        createdAt: mockUser.createdAt.toISOString(),
        rateLimits: mockUser.rateLimits
      });

      expect(mockUserService.getUserById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return 404 when user not found', async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('PUT /api/auth/profile', () => {
    const updateData = {
      subscription: SubscriptionType.PREMIUM
    };

    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, subscription: SubscriptionType.PREMIUM };
      mockUserService.updateUser.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          subscription: updatedUser.subscription,
          createdAt: updatedUser.createdAt.toISOString(),
          rateLimits: updatedUser.rateLimits
        }
      });

      expect(mockUserService.updateUser).toHaveBeenCalledWith(mockUser.id, updateData);
    });

    it('should return 400 for invalid update data', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({
          subscription: 'invalid-subscription'
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty update data', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/api-key/regenerate', () => {
    it('should regenerate API key successfully', async () => {
      const newApiKey = 'mlapi_new123';
      mockUserService.generateApiKey.mockResolvedValue(newApiKey);

      const response = await request(app)
        .post('/api/auth/api-key/regenerate')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        message: 'API key regenerated successfully',
        apiKey: newApiKey
      });

      expect(mockUserService.generateApiKey).toHaveBeenCalledWith(mockUser.id);
    });
  });
});