import { UserManagementService } from '../user-management.service';
import { UserRepository } from '../../../database/repositories/user.repository';
import { AuthUtils } from '../auth.utils';
import { User, CreateUserRequest, AuthenticateUserRequest } from '../../../models/user.model';
import { ValidationError, AuthenticationError, ConflictError } from '../../../models/error.model';
import { SubscriptionType } from '../../../models/constants';

// Mock dependencies
jest.mock('../../../database/repositories/user.repository');
jest.mock('../auth.utils');

const mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
const mockAuthUtils = AuthUtils as jest.Mocked<typeof AuthUtils>;

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  apiKey: 'api-key-123',
  createdAt: new Date('2024-01-01'),
  subscription: SubscriptionType.FREE,
  rateLimits: {
    requestsPerMinute: 10,
    modelsLimit: 5
  }
};

const mockCreateUserRequest: CreateUserRequest = {
  email: 'test@example.com',
  password: 'SecurePassword123!',
  subscription: SubscriptionType.FREE
};

const mockAuthenticateUserRequest: AuthenticateUserRequest = {
  email: 'test@example.com',
  password: 'SecurePassword123!'
};

describe('UserManagementService', () => {
  let userManagementService: UserManagementService;

  beforeEach(() => {
    userManagementService = new UserManagementService(mockUserRepository);
    jest.clearAllMocks();
    
    // Setup default mocks
    mockAuthUtils.isValidEmail.mockReturnValue(true);
    mockAuthUtils.isValidPassword.mockReturnValue({ valid: true, errors: [] });
    mockAuthUtils.hashPassword.mockResolvedValue('hashed-password');
    mockAuthUtils.generateApiKey.mockReturnValue('api-key-123');
    mockAuthUtils.verifyPassword.mockResolvedValue(true);
    mockAuthUtils.generateToken.mockReturnValue('jwt-token-123');
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);
      
      const result = await userManagementService.createUser(mockCreateUserRequest);
      
      expect(result).toEqual(mockUser);
      expect(mockAuthUtils.isValidEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockAuthUtils.isValidPassword).toHaveBeenCalledWith('SecurePassword123!');
      expect(mockAuthUtils.hashPassword).toHaveBeenCalledWith('SecurePassword123!');
      expect(mockAuthUtils.generateApiKey).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...mockCreateUserRequest,
        passwordHash: 'hashed-password',
        apiKey: 'api-key-123'
      });
    });

    it('should throw ValidationError for invalid email', async () => {
      mockAuthUtils.isValidEmail.mockReturnValue(false);
      
      await expect(userManagementService.createUser(mockCreateUserRequest))
        .rejects.toThrow(new ValidationError('Invalid email format'));
      
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for weak password', async () => {
      mockAuthUtils.isValidPassword.mockReturnValue({
        valid: false,
        errors: ['Password too short', 'Missing special characters']
      });
      
      await expect(userManagementService.createUser(mockCreateUserRequest))
        .rejects.toThrow(new ValidationError('Password validation failed'));
      
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should throw ConflictError for existing user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      
      await expect(userManagementService.createUser(mockCreateUserRequest))
        .rejects.toThrow(new ConflictError('User with this email already exists'));
      
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockRejectedValue(new Error('Database error'));
      
      await expect(userManagementService.createUser(mockCreateUserRequest))
        .rejects.toThrow('Database error');
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.findByEmailWithPassword.mockResolvedValue({ passwordHash: 'hashed-password' });
      
      const result = await userManagementService.authenticateUser(mockAuthenticateUserRequest);
      
      expect(result).toEqual({
        user: mockUser,
        token: 'jwt-token-123'
      });
      expect(mockAuthUtils.verifyPassword).toHaveBeenCalledWith('SecurePassword123!', 'hashed-password');
      expect(mockAuthUtils.generateToken).toHaveBeenCalledWith(mockUser);
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      
      await expect(userManagementService.authenticateUser(mockAuthenticateUserRequest))
        .rejects.toThrow(new AuthenticationError('Invalid email or password'));
      
      expect(mockAuthUtils.verifyPassword).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError when password hash not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.findByEmailWithPassword.mockResolvedValue(null);
      
      await expect(userManagementService.authenticateUser(mockAuthenticateUserRequest))
        .rejects.toThrow(new AuthenticationError('Invalid email or password'));
      
      expect(mockAuthUtils.verifyPassword).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError for invalid password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.findByEmailWithPassword.mockResolvedValue({ passwordHash: 'hashed-password' });
      mockAuthUtils.verifyPassword.mockResolvedValue(false);
      
      await expect(userManagementService.authenticateUser(mockAuthenticateUserRequest))
        .rejects.toThrow(new AuthenticationError('Invalid email or password'));
      
      expect(mockAuthUtils.generateToken).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      const result = await userManagementService.getUserById('user-123');
      
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should return null for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      
      const result = await userManagementService.getUserById('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      
      const result = await userManagementService.getUserByEmail('test@example.com');
      
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return null for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      
      const result = await userManagementService.getUserByEmail('non-existent@example.com');
      
      expect(result).toBeNull();
    });
  });

  describe('getUserByApiKey', () => {
    it('should return user by API key', async () => {
      mockUserRepository.findByApiKey.mockResolvedValue(mockUser);
      
      const result = await userManagementService.getUserByApiKey('api-key-123');
      
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findByApiKey).toHaveBeenCalledWith('api-key-123');
    });

    it('should return null for invalid API key', async () => {
      mockUserRepository.findByApiKey.mockResolvedValue(null);
      
      const result = await userManagementService.getUserByApiKey('invalid-key');
      
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updates = { subscription: SubscriptionType.PREMIUM };
      const updatedUser = { ...mockUser, subscription: SubscriptionType.PREMIUM };
      
      mockUserRepository.update.mockResolvedValue(updatedUser);
      
      const result = await userManagementService.updateUser('user-123', updates);
      
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', updates);
    });

    it('should filter out sensitive fields from updates', async () => {
      const updates = {
        subscription: SubscriptionType.PREMIUM,
        id: 'malicious-id',
        apiKey: 'malicious-key',
        createdAt: new Date()
      };
      
      const expectedUpdates = { subscription: SubscriptionType.PREMIUM };
      mockUserRepository.update.mockResolvedValue(mockUser);
      
      await userManagementService.updateUser('user-123', updates);
      
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', expectedUpdates);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockUserRepository.delete.mockResolvedValue(undefined);
      
      await userManagementService.deleteUser('user-123');
      
      expect(mockUserRepository.delete).toHaveBeenCalledWith('user-123');
    });

    it('should handle repository errors', async () => {
      mockUserRepository.delete.mockRejectedValue(new Error('Delete failed'));
      
      await expect(userManagementService.deleteUser('user-123'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('generateApiKey', () => {
    it('should generate new API key for user', async () => {
      const updatedUser = { ...mockUser, apiKey: 'new-api-key-456' };
      mockAuthUtils.generateApiKey.mockReturnValue('new-api-key-456');
      mockUserRepository.update.mockResolvedValue(updatedUser);
      
      const result = await userManagementService.generateApiKey('user-123');
      
      expect(result).toBe('new-api-key-456');
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', { apiKey: 'new-api-key-456' });
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      mockUserRepository.findByApiKey.mockResolvedValue(mockUser);
      
      const result = await userManagementService.validateApiKey('api-key-123');
      
      expect(result).toBe(true);
      expect(mockUserRepository.findByApiKey).toHaveBeenCalledWith('api-key-123');
    });

    it('should return false for invalid API key', async () => {
      mockUserRepository.findByApiKey.mockResolvedValue(null);
      
      const result = await userManagementService.validateApiKey('invalid-key');
      
      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockUserRepository.findByEmail.mockRejectedValue(new Error('Connection failed'));
      
      await expect(userManagementService.createUser(mockCreateUserRequest))
        .rejects.toThrow('Connection failed');
    });

    it('should handle password hashing errors', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockAuthUtils.hashPassword.mockRejectedValue(new Error('Hashing failed'));
      
      await expect(userManagementService.createUser(mockCreateUserRequest))
        .rejects.toThrow('Hashing failed');
    });

    it('should handle token generation errors', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.findByEmailWithPassword.mockResolvedValue({ passwordHash: 'hashed-password' });
      mockAuthUtils.generateToken.mockImplementation(() => {
        throw new Error('Token generation failed');
      });
      
      await expect(userManagementService.authenticateUser(mockAuthenticateUserRequest))
        .rejects.toThrow('Token generation failed');
    });
  });

  describe('edge cases', () => {
    it('should handle empty email', async () => {
      const invalidRequest = { ...mockCreateUserRequest, email: '' };
      mockAuthUtils.isValidEmail.mockReturnValue(false);
      
      await expect(userManagementService.createUser(invalidRequest))
        .rejects.toThrow(new ValidationError('Invalid email format'));
    });

    it('should handle empty password', async () => {
      const invalidRequest = { ...mockCreateUserRequest, password: '' };
      mockAuthUtils.isValidPassword.mockReturnValue({
        valid: false,
        errors: ['Password is required']
      });
      
      await expect(userManagementService.createUser(invalidRequest))
        .rejects.toThrow(new ValidationError('Password validation failed'));
    });

    it('should handle null user updates', async () => {
      const result = await userManagementService.updateUser('user-123', {});
      
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {});
    });
  });
});