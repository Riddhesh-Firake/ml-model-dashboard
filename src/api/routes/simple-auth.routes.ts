import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import Joi from 'joi';
import { DatabaseConnection } from '../../database/connection';
import { AuthUtils } from '../../services/user-management/auth.utils';

export class SimpleAuthRoutes {
  private router: Router;
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.router = Router();
    this.db = db;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post('/register', this.validateRegistration, this.register);
    this.router.post('/login', this.validateLogin, this.login);
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

  private register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Check if user already exists
      const existingUser = await this.db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        res.status(409).json({
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Hash password and generate API key
      const passwordHash = await bcrypt.hash(password, 12);
      const apiKey = 'mlapi_' + crypto.randomBytes(32).toString('hex');
      const userId = uuidv4();

      // Insert user
      const insertQuery = `
        INSERT INTO users (id, email, password_hash, api_key, subscription, requests_per_minute, models_limit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, subscription, requests_per_minute, models_limit, created_at
      `;

      const result = await this.db.query(insertQuery, [
        userId,
        email,
        passwordHash,
        apiKey,
        'free',
        10,
        5
      ]);

      const user = result.rows[0];

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          subscription: user.subscription,
          createdAt: user.created_at,
          rateLimits: {
            requestsPerMinute: user.requests_per_minute,
            modelsLimit: user.models_limit
          }
        },
        apiKey: apiKey // Return the generated API key
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Registration failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  private login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Find user
      const userResult = await this.db.query(
        'SELECT id, email, password_hash, subscription, requests_per_minute, models_limit, created_at FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const user = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generate JWT token using AuthUtils
      const token = AuthUtils.generateToken({
        id: user.id,
        email: user.email,
        subscription: user.subscription
      } as any);

      res.json({
        message: 'Authentication successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          subscription: user.subscription,
          createdAt: user.created_at,
          rateLimits: {
            requestsPerMinute: user.requests_per_minute,
            modelsLimit: user.models_limit
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  getRouter(): Router {
    return this.router;
  }
}