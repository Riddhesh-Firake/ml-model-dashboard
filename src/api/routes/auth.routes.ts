import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { UserManagementService } from '../../services/user-management/user-management.service';
import { AuthMiddleware } from '../../services/user-management/auth.middleware';
import { CreateUserRequest, AuthenticateUserRequest } from '../../models/user.model';
import { AppError } from '../../models/error.model';

export class AuthRoutes {
  private router: Router;

  constructor(
    private userService: UserManagementService,
    private authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // User registration
    this.router.post('/register', this.validateRegistration, this.register);
    
    // User login
    this.router.post('/login', this.validateLogin, this.login);
    
    // Get current user profile (requires authentication)
    this.router.get('/profile', this.authMiddleware.authenticateAny, this.getProfile);
    
    // Update user profile (requires authentication)
    this.router.put('/profile', this.authMiddleware.authenticateAny, this.validateProfileUpdate, this.updateProfile);
    
    // Generate new API key (requires authentication)
    this.router.post('/api-key/regenerate', this.authMiddleware.authenticateJWT, this.regenerateApiKey);
  }

  private validateRegistration = (req: Request, res: Response, next: Function): void => {
    const schema = Joi.object({
      email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
      password: Joi.string().min(8).required().messages({
        'string.min': 'Password must be at least 8 characters long',
        'any.required': 'Password is required'
      })
    });

    const { error } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details.map(detail => detail.message),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };

  private validateLogin = (req: Request, res: Response, next: Function): void => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details.map(detail => detail.message),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };

  private validateProfileUpdate = (req: Request, res: Response, next: Function): void => {
    const schema = Joi.object({
      email: Joi.string().email().optional(),
      subscription: Joi.string().valid('free', 'premium').optional()
    }).min(1);

    const { error } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details.map(detail => detail.message),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };

  private register = async (req: Request, res: Response): Promise<void> => {
    try {
      const createUserRequest: CreateUserRequest = req.body;
      const user = await this.userService.createUser(createUserRequest);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          subscription: user.subscription,
          createdAt: user.createdAt,
          rateLimits: user.rateLimits
        },
        apiKey: user.apiKey
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private login = async (req: Request, res: Response): Promise<void> => {
    try {
      const loginRequest: AuthenticateUserRequest = req.body;
      const authResponse = await this.userService.authenticateUser(loginRequest);

      res.json({
        message: 'Authentication successful',
        token: authResponse.token,
        user: {
          id: authResponse.user.id,
          email: authResponse.user.email,
          subscription: authResponse.user.subscription,
          createdAt: authResponse.user.createdAt,
          rateLimits: authResponse.user.rateLimits
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
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

      const user = await this.userService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          apiKey: user.apiKey,
          subscription: user.subscription,
          createdAt: user.createdAt,
          rateLimits: user.rateLimits
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
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

      const updates = req.body;
      const updatedUser = await this.userService.updateUser(req.user.userId, updates);

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          subscription: updatedUser.subscription,
          createdAt: updatedUser.createdAt,
          rateLimits: updatedUser.rateLimits
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private regenerateApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
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

      const newApiKey = await this.userService.generateApiKey(req.user.userId);

      res.json({
        message: 'API key regenerated successfully',
        apiKey: newApiKey
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: any, res: Response): void {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.error('Unexpected error in auth routes:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}