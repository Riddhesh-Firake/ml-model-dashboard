import { Request, Response, NextFunction } from 'express';
import { AuthUtils } from './auth.utils';
import { UserManagementService } from './user-management.service';
import { ApiKeyService } from './api-key.service';
import { AuthenticationError, AuthorizationError } from '../../models/error.model';

// Extend Express Request to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        subscription: string;
      };
      model?: import('../../models').ModelMetadata;
    }
  }
}

export class AuthMiddleware {
  constructor(
    private userService: UserManagementService,
    private apiKeyService: ApiKeyService
  ) {}

  /**
   * Middleware to authenticate JWT tokens
   */
  authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = AuthUtils.extractTokenFromHeader(authHeader);

      if (!token) {
        throw new AuthenticationError('No token provided');
      }

      const payload = AuthUtils.verifyToken(token);
      
      // Verify user still exists
      const user = await this.userService.getUserById(payload.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      req.user = {
        userId: payload.userId,
        email: payload.email,
        subscription: payload.subscription
      };

      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
            timestamp: new Date().toISOString()
          }
        });
      }
    }
  };

  /**
   * Middleware to authenticate API keys
   */
  authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        throw new AuthenticationError('No API key provided');
      }

      // Use the new API key service for validation
      const validation = await this.apiKeyService.validateApiKey(apiKey);
      if (!validation.valid || !validation.userId) {
        throw new AuthenticationError('Invalid or expired API key');
      }

      // Get user details
      const user = await this.userService.getUserById(validation.userId);
      if (!user) {
        throw new AuthenticationError('User associated with API key not found');
      }

      req.user = {
        userId: user.id,
        email: user.email,
        subscription: user.subscription
      };

      next();
    } catch (error) {
      res.status(401).json({
        error: {
          code: 'API_KEY_AUTHENTICATION_FAILED',
          message: error instanceof AuthenticationError ? error.message : 'Invalid API key',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * Middleware to authenticate either JWT or API key
   */
  authenticateAny = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    if (authHeader) {
      // Try JWT authentication first
      return this.authenticateJWT(req, res, next);
    } else if (apiKey) {
      // Fall back to API key authentication
      return this.authenticateApiKey(req, res, next);
    } else {
      res.status(401).json({
        error: {
          code: 'NO_AUTHENTICATION',
          message: 'No authentication method provided. Use Bearer token or X-API-Key header',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * Middleware to check if user has premium subscription
   */
  requirePremium = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (req.user.subscription !== 'premium') {
      res.status(403).json({
        error: {
          code: 'PREMIUM_REQUIRED',
          message: 'Premium subscription required for this feature',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };

  /**
   * Optional authentication middleware - sets user if authenticated but doesn't require it
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] as string;

      if (authHeader) {
        const token = AuthUtils.extractTokenFromHeader(authHeader);
        if (token) {
          const payload = AuthUtils.verifyToken(token);
          const user = await this.userService.getUserById(payload.userId);
          if (user) {
            req.user = {
              userId: payload.userId,
              email: payload.email,
              subscription: payload.subscription
            };
          }
        }
      } else if (apiKey) {
        const validation = await this.apiKeyService.validateApiKey(apiKey);
        if (validation.valid && validation.userId) {
          const user = await this.userService.getUserById(validation.userId);
          if (user) {
            req.user = {
              userId: user.id,
              email: user.email,
              subscription: user.subscription
            };
          }
        }
      }

      next();
    } catch (error) {
      // For optional auth, we don't fail on invalid tokens, just continue without user
      next();
    }
  };
}