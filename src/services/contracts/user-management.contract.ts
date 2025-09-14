import { User, CreateUserRequest, AuthenticateUserRequest, AuthenticateUserResponse } from '../../models';

export interface IUserManagementService {
  createUser(request: CreateUserRequest): Promise<User>;
  authenticateUser(request: AuthenticateUserRequest): Promise<AuthenticateUserResponse>;
  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByApiKey(apiKey: string): Promise<User | null>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  generateApiKey(userId: string): Promise<string>;
  validateApiKey(apiKey: string): Promise<boolean>;
}