import { SubscriptionType } from './constants';

export interface User {
  id: string;
  email: string;
  apiKey: string;
  createdAt: Date;
  subscription: SubscriptionType;
  rateLimits: {
    requestsPerMinute: number;
    modelsLimit: number;
  };
}

export interface CreateUserRequest {
  email: string;
  password: string;
}

export interface AuthenticateUserRequest {
  email: string;
  password: string;
}

export interface AuthenticateUserResponse {
  user: User;
  token: string;
}