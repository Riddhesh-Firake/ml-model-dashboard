import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { ApiKeyService } from '../../services/user-management/api-key.service';
import { AuthMiddleware } from '../../services/user-management/auth.middleware';
import { CreateApiKeyRequest, UpdateApiKeyRequest } from '../../models/api-key.model';
import { AppError } from '../../models/error.model';

export class ApiKeyRoutes {
  private router: Router;

  constructor(
    private apiKeyService: ApiKeyService,
    private authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // All API key routes require JWT authentication (not API key auth to avoid circular dependency)
    
    // Create new API key
    this.router.post('/', this.authMiddleware.authenticateJWT, this.validateCreateApiKey, this.createApiKey);
    
    // List user's API keys
    this.router.get('/', this.authMiddleware.authenticateJWT, this.listApiKeys);
    
    // Get specific API key details
    this.router.get('/:keyId', this.authMiddleware.authenticateJWT, this.getApiKey);
    
    // Update API key (name, expiration, etc.)
    this.router.put('/:keyId', this.authMiddleware.authenticateJWT, this.validateUpdateApiKey, this.updateApiKey);
    
    // Rotate API key (generate new key value)
    this.router.post('/:keyId/rotate', this.authMiddleware.authenticateJWT, this.rotateApiKey);
    
    // Revoke/deactivate API key
    this.router.delete('/:keyId', this.authMiddleware.authenticateJWT, this.revokeApiKey);
  }

  private validateCreateApiKey = (req: Request, res: Response, next: Function): void => {
    const schema = Joi.object({
      name: Joi.string().min(1).max(100).optional().messages({
        'string.min': 'API key name must be at least 1 character long',
        'string.max': 'API key name must be at most 100 characters long'
      }),
      expiresAt: Joi.date().greater('now').optional().messages({
        'date.greater': 'Expiration date must be in the future'
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

  private validateUpdateApiKey = (req: Request, res: Response, next: Function): void => {
    const schema = Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      isActive: Joi.boolean().optional(),
      expiresAt: Joi.date().greater('now').allow(null).optional().messages({
        'date.greater': 'Expiration date must be in the future'
      })
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

  private createApiKey = async (req: Request, res: Response): Promise<void> => {
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

      const createRequest: CreateApiKeyRequest = {
        userId: req.user.userId,
        name: req.body.name,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined
      };

      const apiKey = await this.apiKeyService.createApiKey(createRequest);

      res.status(201).json({
        message: 'API key created successfully',
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key: apiKey.key, // Only returned on creation
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
          expiresAt: apiKey.expiresAt
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private listApiKeys = async (req: Request, res: Response): Promise<void> => {
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

      const apiKeys = await this.apiKeyService.listApiKeys(req.user.userId);

      res.json({
        apiKeys: apiKeys.map(key => ({
          id: key.id,
          name: key.name,
          isActive: key.isActive,
          createdAt: key.createdAt,
          expiresAt: key.expiresAt,
          lastUsed: key.lastUsed
        }))
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private getApiKey = async (req: Request, res: Response): Promise<void> => {
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

      const { keyId } = req.params;
      if (!keyId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PARAMETER',
            message: 'Key ID is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      const apiKey = await this.apiKeyService.getApiKey(keyId, req.user.userId);

      res.json({
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
          expiresAt: apiKey.expiresAt,
          lastUsed: apiKey.lastUsed
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private updateApiKey = async (req: Request, res: Response): Promise<void> => {
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

      const { keyId } = req.params;
      if (!keyId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PARAMETER',
            message: 'Key ID is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      const updates: UpdateApiKeyRequest = {
        name: req.body.name,
        isActive: req.body.isActive,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : req.body.expiresAt
      };

      const apiKey = await this.apiKeyService.updateApiKey(keyId, req.user.userId, updates);

      res.json({
        message: 'API key updated successfully',
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
          expiresAt: apiKey.expiresAt,
          lastUsed: apiKey.lastUsed
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private rotateApiKey = async (req: Request, res: Response): Promise<void> => {
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

      const { keyId } = req.params;
      if (!keyId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PARAMETER',
            message: 'Key ID is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      const apiKey = await this.apiKeyService.rotateApiKey(keyId, req.user.userId);

      res.json({
        message: 'API key rotated successfully',
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key: apiKey.key, // New key value returned
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
          expiresAt: apiKey.expiresAt,
          lastUsed: apiKey.lastUsed
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private revokeApiKey = async (req: Request, res: Response): Promise<void> => {
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

      const { keyId } = req.params;
      if (!keyId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PARAMETER',
            message: 'Key ID is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      await this.apiKeyService.revokeApiKey(keyId, req.user.userId);

      res.json({
        message: 'API key revoked successfully'
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
      console.error('Unexpected error in API key routes:', error);
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