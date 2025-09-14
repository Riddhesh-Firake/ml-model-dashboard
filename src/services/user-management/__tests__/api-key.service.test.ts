import { ApiKeyService } from '../api-key.service';
import { ApiKeyRepository } from '../../../database/repositories/api-key.repository';
import { UserRepository } from '../../../database/repositories/user.repository';
import { AuthUtils } from '../auth.utils';
import { ValidationError, NotFoundError, AuthorizationError } from '../../../models/error.model';
import { ApiKey, CreateApiKeyRequest } from '../../../models/api-key.model';
import { User } from '../../../models/user.model';
import { SubscriptionType } from '../../../models/constants';

// Mock dependencies
jest.mock('../../../database/repositories/api-key.repository');
jest.mock('../../../database/repositories/user.repository');
jest.mock('../auth.utils');

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let mockApiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    apiKey: 'old-api-key',
    subscription: SubscriptionType.FREE,
    createdAt: new Date(),
    rateLimits: {
      requestsPerMinute: 60,
      modelsLimit: 5
    }
  };

  const mockApiKey: ApiKey = {
    id: 'key-123',
    userId: 'user-123',
    keyHash: 'hashed-key',
    name: 'Test API Key',
    isActive: true,
    createdAt: new Date(),
    expiresAt: undefined,
    lastUsed: undefined
  };

  beforeEach(() => {
    mockApiKeyRepository = new ApiKeyRepository({} as any) as jest.Mocked<ApiKeyRepository>;
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    apiKeyService = new ApiKeyService(mockApiKeyRepository, mockUserRepository);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    const createRequest: CreateApiKeyRequest = {
      userId: 'user-123',
      name: 'Test API Key'
    };

    beforeEach(() => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockApiKeyRepository.countActiveKeysByUser.mockResolvedValue(2);
      (AuthUtils.generateApiKey as jest.Mock).mockReturnValue('mlapi_newkey123');
      (AuthUtils.hashApiKey as jest.Mock).mockResolvedValue('hashed-new-key');
      mockApiKeyRepository.create.mockResolvedValue(mockApiKey);
    });

    it('should create a new API key successfully', async () => {
      const result = await apiKeyService.createApiKey(createRequest);

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockApiKeyRepository.countActiveKeysByUser).toHaveBeenCalledWith('user-123');
      expect(AuthUtils.generateApiKey).toHaveBeenCalled();
      expect(AuthUtils.hashApiKey).toHaveBeenCalledWith('mlapi_newkey123');
      expect(mockApiKeyRepository.create).toHaveBeenCalledWith({
        ...createRequest,
        keyHash: 'hashed-new-key',
        name: 'Test API Key'
      });

      expect(result).toEqual({
        id: mockApiKey.id,
        name: mockApiKey.name,
        key: 'mlapi_newkey123',
        isActive: mockApiKey.isActive,
        createdAt: mockApiKey.createdAt,
        expiresAt: mockApiKey.expiresAt,
        lastUsed: mockApiKey.lastUsed
      });
    });

    it('should use default name when none provided', async () => {
      const requestWithoutName = { userId: 'user-123' };
      
      await apiKeyService.createApiKey(requestWithoutName);

      expect(mockApiKeyRepository.create).toHaveBeenCalledWith({
        ...requestWithoutName,
        keyHash: 'hashed-new-key',
        name: 'Default API Key'
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(apiKeyService.createApiKey(createRequest))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when user has reached maximum API keys', async () => {
      mockApiKeyRepository.countActiveKeysByUser.mockResolvedValue(10);

      await expect(apiKeyService.createApiKey(createRequest))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when expiration date is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const requestWithPastExpiration = {
        ...createRequest,
        expiresAt: pastDate
      };

      await expect(apiKeyService.createApiKey(requestWithPastExpiration))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('validateApiKey', () => {
    beforeEach(() => {
      (AuthUtils.hashApiKey as jest.Mock).mockResolvedValue('hashed-key');
    });

    it('should validate active API key successfully', async () => {
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.updateLastUsed.mockResolvedValue();

      const result = await apiKeyService.validateApiKey('test-api-key');

      expect(AuthUtils.hashApiKey).toHaveBeenCalledWith('test-api-key');
      expect(mockApiKeyRepository.findByKeyHash).toHaveBeenCalledWith('hashed-key');
      expect(mockApiKeyRepository.updateLastUsed).toHaveBeenCalledWith('hashed-key');
      expect(result).toEqual({
        valid: true,
        userId: 'user-123'
      });
    });

    it('should return invalid for non-existent API key', async () => {
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(null);

      const result = await apiKeyService.validateApiKey('invalid-key');

      expect(result).toEqual({ valid: false });
    });

    it('should return invalid for inactive API key', async () => {
      const inactiveKey = { ...mockApiKey, isActive: false };
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(inactiveKey);

      const result = await apiKeyService.validateApiKey('inactive-key');

      expect(result).toEqual({ valid: false });
    });

    it('should return invalid and deactivate expired API key', async () => {
      const expiredKey = {
        ...mockApiKey,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      };
      mockApiKeyRepository.findByKeyHash.mockResolvedValue(expiredKey);
      mockApiKeyRepository.deactivateApiKey.mockResolvedValue(expiredKey);

      const result = await apiKeyService.validateApiKey('expired-key');

      expect(mockApiKeyRepository.deactivateApiKey).toHaveBeenCalledWith(mockApiKey.id);
      expect(result).toEqual({ valid: false });
    });

    it('should handle validation errors gracefully', async () => {
      (AuthUtils.hashApiKey as jest.Mock).mockRejectedValue(new Error('Hash error'));

      const result = await apiKeyService.validateApiKey('error-key');

      expect(result).toEqual({ valid: false });
    });
  });

  describe('rotateApiKey', () => {
    beforeEach(() => {
      mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
      (AuthUtils.generateApiKey as jest.Mock).mockReturnValue('mlapi_rotatedkey123');
      (AuthUtils.hashApiKey as jest.Mock).mockResolvedValue('hashed-rotated-key');
      mockApiKeyRepository.update.mockResolvedValue({
        ...mockApiKey,
        keyHash: 'hashed-rotated-key'
      });
    });

    it('should rotate API key successfully', async () => {
      const result = await apiKeyService.rotateApiKey('key-123', 'user-123');

      expect(mockApiKeyRepository.findById).toHaveBeenCalledWith('key-123');
      expect(AuthUtils.generateApiKey).toHaveBeenCalled();
      expect(AuthUtils.hashApiKey).toHaveBeenCalledWith('mlapi_rotatedkey123');
      expect(mockApiKeyRepository.update).toHaveBeenCalledWith('key-123', {
        keyHash: 'hashed-rotated-key'
      });

      expect(result.key).toBe('mlapi_rotatedkey123');
    });

    it('should throw NotFoundError when API key does not exist', async () => {
      mockApiKeyRepository.findById.mockResolvedValue(null);

      await expect(apiKeyService.rotateApiKey('nonexistent', 'user-123'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user does not own the API key', async () => {
      const otherUserKey = { ...mockApiKey, userId: 'other-user' };
      mockApiKeyRepository.findById.mockResolvedValue(otherUserKey);

      await expect(apiKeyService.rotateApiKey('key-123', 'user-123'))
        .rejects.toThrow(AuthorizationError);
    });
  });

  describe('revokeApiKey', () => {
    beforeEach(() => {
      mockApiKeyRepository.findById.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.deactivateApiKey.mockResolvedValue(mockApiKey);
    });

    it('should revoke API key successfully', async () => {
      await apiKeyService.revokeApiKey('key-123', 'user-123');

      expect(mockApiKeyRepository.findById).toHaveBeenCalledWith('key-123');
      expect(mockApiKeyRepository.deactivateApiKey).toHaveBeenCalledWith('key-123');
    });

    it('should throw NotFoundError when API key does not exist', async () => {
      mockApiKeyRepository.findById.mockResolvedValue(null);

      await expect(apiKeyService.revokeApiKey('nonexistent', 'user-123'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user does not own the API key', async () => {
      const otherUserKey = { ...mockApiKey, userId: 'other-user' };
      mockApiKeyRepository.findById.mockResolvedValue(otherUserKey);

      await expect(apiKeyService.revokeApiKey('key-123', 'user-123'))
        .rejects.toThrow(AuthorizationError);
    });
  });

  describe('listApiKeys', () => {
    it('should list user API keys successfully', async () => {
      const apiKeys = [mockApiKey, { ...mockApiKey, id: 'key-456', name: 'Another Key' }];
      mockApiKeyRepository.findByUserId.mockResolvedValue(apiKeys);

      const result = await apiKeyService.listApiKeys('user-123');

      expect(mockApiKeyRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: mockApiKey.id,
        name: mockApiKey.name,
        isActive: mockApiKey.isActive,
        createdAt: mockApiKey.createdAt,
        expiresAt: mockApiKey.expiresAt,
        lastUsed: mockApiKey.lastUsed
      });
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should cleanup expired keys successfully', async () => {
      mockApiKeyRepository.deleteExpiredKeys.mockResolvedValue(3);

      const result = await apiKeyService.cleanupExpiredKeys();

      expect(mockApiKeyRepository.deleteExpiredKeys).toHaveBeenCalled();
      expect(result).toBe(3);
    });
  });
});