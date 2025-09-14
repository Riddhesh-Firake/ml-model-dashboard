import { UserRepository } from '../../database/repositories/user.repository';
import { User, CreateUserRequest, AuthenticateUserRequest, AuthenticateUserResponse } from '../../models/user.model';
import { IUserManagementService } from '../contracts/user-management.contract';
import { AuthUtils } from './auth.utils';
import { ValidationError, AuthenticationError, ConflictError, AppError, DatabaseError } from '../../models/error.model';
import { logger } from '../monitoring/logger.service';

export class UserManagementService implements IUserManagementService {
  constructor(private userRepository: UserRepository) { }

  async createUser(request: CreateUserRequest): Promise<User> {
    try {
      // Validate email format
      if (!AuthUtils.isValidEmail(request.email)) {
        throw new ValidationError('Invalid email format');
      }

      // Validate password strength
      const passwordValidation = AuthUtils.isValidPassword(request.password);
      if (!passwordValidation.valid) {
        throw new ValidationError('Password validation failed', {
          errors: passwordValidation.errors
        });
      }

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(request.email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password and generate API key
      const passwordHash = await AuthUtils.hashPassword(request.password);
      const apiKey = AuthUtils.generateApiKey();

      // Create user
      const userData = {
        ...request,
        passwordHash,
        apiKey
      };

      return this.userRepository.create(userData);
    } catch (error) {
      if (error instanceof AppError) {
        // Re-throw known application errors
        throw error;
      }
      // Log the underlying database error for debugging
      logger.error('Database create user error:', error as Error);
      throw new DatabaseError('Failed to create user due to a database error');
    }
  }

  async authenticateUser(request: AuthenticateUserRequest): Promise<AuthenticateUserResponse> {
    try {
      // Find user by email
      const user = await this.userRepository.findByEmail(request.email);
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Get password hash from database
      const userWithPassword = await this.getUserWithPassword(request.email);
      if (!userWithPassword) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await AuthUtils.verifyPassword(request.password, userWithPassword.passwordHash);
      if (!isValidPassword) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Generate JWT token
      const token = AuthUtils.generateToken(user);

      return {
        user,
        token
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Authentication error:', error as Error);
      throw new DatabaseError('An unexpected error occurred during authentication');
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      return this.userRepository.findById(userId);
    } catch (error) {
      logger.error('Get user by ID error:', error as Error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return this.userRepository.findByEmail(email);
    } catch (error) {
      logger.error('Get user by email error:', error as Error);
      return null;
    }
  }

  async getUserByApiKey(apiKey: string): Promise<User | null> {
    try {
      return this.userRepository.findByApiKey(apiKey);
    } catch (error) {
      logger.error('Get user by API key error:', error as Error);
      return null;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      // Don't allow updating sensitive fields directly
      const allowedUpdates = { ...updates };
      delete allowedUpdates.id;
      delete allowedUpdates.apiKey;
      delete allowedUpdates.createdAt;

      return this.userRepository.update(userId, allowedUpdates);
    } catch (error) {
      logger.error('Update user error:', error as Error);
      throw new DatabaseError('Failed to update user due to a database error');
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.userRepository.delete(userId);
    } catch (error) {
      logger.error('Delete user error:', error as Error);
      throw new DatabaseError('Failed to delete user due to a database error');
    }
  }

  async generateApiKey(userId: string): Promise<string> {
    try {
      const newApiKey = AuthUtils.generateApiKey();

      await this.userRepository.update(userId, { apiKey: newApiKey });

      return newApiKey;
    } catch (error) {
      logger.error('Regenerate API key error:', error as Error);
      throw new DatabaseError('Failed to regenerate API key due to a database error');
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findByApiKey(apiKey);
      return user !== null;
    } catch (error) {
      logger.error('API key validation error:', error as Error);
      return false;
    }
  }

  /**
   * Private method to get user with password hash for authentication
   */
  private async getUserWithPassword(email: string): Promise<{ passwordHash: string } | null> {
    try {
      return this.userRepository.findByEmailWithPassword(email);
    } catch (error) {
      logger.error('Get user with password error:', error as Error);
      return null;
    }
  }
}