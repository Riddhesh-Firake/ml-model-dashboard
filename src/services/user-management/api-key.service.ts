import { ApiKeyRepository } from '../../database/repositories/api-key.repository';
import { UserRepository } from '../../database/repositories/user.repository';
import { 
  ApiKey, 
  CreateApiKeyRequest, 
  ApiKeyResponse, 
  ApiKeyListItem, 
  UpdateApiKeyRequest 
} from '../../models/api-key.model';
import { AuthUtils } from './auth.utils';
import { ValidationError, NotFoundError, AuthorizationError } from '../../models/error.model';

export interface IApiKeyService {
  createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyResponse>;
  listApiKeys(userId: string): Promise<ApiKeyListItem[]>;
  getApiKey(keyId: string, userId: string): Promise<ApiKeyListItem>;
  updateApiKey(keyId: string, userId: string, updates: UpdateApiKeyRequest): Promise<ApiKeyListItem>;
  revokeApiKey(keyId: string, userId: string): Promise<void>;
  validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string }>;
  rotateApiKey(keyId: string, userId: string): Promise<ApiKeyResponse>;
  cleanupExpiredKeys(): Promise<number>;
}

export class ApiKeyService implements IApiKeyService {
  private static readonly MAX_KEYS_PER_USER = 10;
  private static readonly DEFAULT_KEY_NAME = 'Default API Key';

  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private userRepository: UserRepository
  ) {}

  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyResponse> {
    // Validate user exists
    const user = await this.userRepository.findById(request.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user has reached the maximum number of API keys
    const activeKeyCount = await this.apiKeyRepository.countActiveKeysByUser(request.userId);
    if (activeKeyCount >= ApiKeyService.MAX_KEYS_PER_USER) {
      throw new ValidationError(`Maximum number of API keys (${ApiKeyService.MAX_KEYS_PER_USER}) reached`);
    }

    // Validate expiration date if provided
    if (request.expiresAt && request.expiresAt <= new Date()) {
      throw new ValidationError('Expiration date must be in the future');
    }

    // Generate new API key
    const apiKey = AuthUtils.generateApiKey();
    const keyHash = await AuthUtils.hashApiKey(apiKey);

    // Create API key record
    const apiKeyData = {
      ...request,
      keyHash,
      name: request.name || ApiKeyService.DEFAULT_KEY_NAME
    };

    const createdApiKey = await this.apiKeyRepository.create(apiKeyData);

    return {
      id: createdApiKey.id,
      name: createdApiKey.name,
      key: apiKey, // Only returned on creation
      isActive: createdApiKey.isActive,
      createdAt: createdApiKey.createdAt,
      expiresAt: createdApiKey.expiresAt,
      lastUsed: createdApiKey.lastUsedAt
    };
  }

  async listApiKeys(userId: string): Promise<ApiKeyListItem[]> {
    const apiKeys = await this.apiKeyRepository.findByUserId(userId);
    
    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      isActive: key.isActive,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsed: key.lastUsedAt
    }));
  }

  async getApiKey(keyId: string, userId: string): Promise<ApiKeyListItem> {
    const apiKey = await this.apiKeyRepository.findById(keyId);
    
    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    if (apiKey.userId !== userId) {
      throw new AuthorizationError('Access denied to this API key');
    }

    return {
      id: apiKey.id,
      name: apiKey.name,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      lastUsed: apiKey.lastUsedAt
    };
  }

  async updateApiKey(keyId: string, userId: string, updates: UpdateApiKeyRequest): Promise<ApiKeyListItem> {
    const existingKey = await this.apiKeyRepository.findById(keyId);
    
    if (!existingKey) {
      throw new NotFoundError('API key not found');
    }

    if (existingKey.userId !== userId) {
      throw new AuthorizationError('Access denied to this API key');
    }

    // Validate expiration date if provided
    if (updates.expiresAt && updates.expiresAt <= new Date()) {
      throw new ValidationError('Expiration date must be in the future');
    }

    const updatedKey = await this.apiKeyRepository.update(keyId, updates);

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      isActive: updatedKey.isActive,
      createdAt: updatedKey.createdAt,
      expiresAt: updatedKey.expiresAt,
      lastUsed: updatedKey.lastUsedAt
    };
  }

  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    const existingKey = await this.apiKeyRepository.findById(keyId);
    
    if (!existingKey) {
      throw new NotFoundError('API key not found');
    }

    if (existingKey.userId !== userId) {
      throw new AuthorizationError('Access denied to this API key');
    }

    await this.apiKeyRepository.deactivateApiKey(keyId);
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      // First, try to find the API key in the dedicated api_keys table
      const keyHash = await AuthUtils.hashApiKey(apiKey);
      const apiKeyRecord = await this.apiKeyRepository.findByKeyHash(keyHash);

      if (apiKeyRecord) {
        // Check if key is active
        if (!apiKeyRecord.isActive) {
          return { valid: false };
        }

        // Check if key is expired
        if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt <= new Date()) {
          // Automatically deactivate expired key
          await this.apiKeyRepository.deactivateApiKey(apiKeyRecord.id);
          return { valid: false };
        }

        // Update last used timestamp
        await this.apiKeyRepository.updateLastUsed(keyHash);

        return {
          valid: true,
          userId: apiKeyRecord.userId
        };
      }

      // Fallback: Check if the API key exists in the users table (for backward compatibility)
      const user = await this.userRepository.findByApiKey(apiKey);
      if (user) {
        return {
          valid: true,
          userId: user.id
        };
      }

      return { valid: false };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { valid: false };
    }
  }

  async rotateApiKey(keyId: string, userId: string): Promise<ApiKeyResponse> {
    const existingKey = await this.apiKeyRepository.findById(keyId);
    
    if (!existingKey) {
      throw new NotFoundError('API key not found');
    }

    if (existingKey.userId !== userId) {
      throw new AuthorizationError('Access denied to this API key');
    }

    // Generate new API key
    const newApiKey = AuthUtils.generateApiKey();
    const newKeyHash = await AuthUtils.hashApiKey(newApiKey);

    // Update the existing key with new hash
    const updatedKey = await this.apiKeyRepository.update(keyId, {
      keyHash: newKeyHash
    });

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      key: newApiKey, // Return the new key
      isActive: updatedKey.isActive,
      createdAt: updatedKey.createdAt,
      expiresAt: updatedKey.expiresAt,
      lastUsed: updatedKey.lastUsedAt
    };
  }

  async cleanupExpiredKeys(): Promise<number> {
    return await this.apiKeyRepository.deleteExpiredKeys();
  }
}