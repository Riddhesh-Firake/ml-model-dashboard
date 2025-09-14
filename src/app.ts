// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DatabaseManager } from './database/database.manager';
import { UserRepository } from './database/repositories/user.repository';
import { ApiKeyRepository } from './database/repositories/api-key.repository';
import { UserManagementService } from './services/user-management/user-management.service';
import { ApiKeyService } from './services/user-management/api-key.service';
import { AuthMiddleware } from './services/user-management/auth.middleware';
import { RateLimitMiddleware } from './services/security/rate-limit.middleware';
import { RequestQueueMiddleware } from './services/security/request-queue.middleware';
import { CSPMiddleware } from './services/security/csp.middleware';
import { NonceService } from './services/security/nonce.service';
import { TemplateNonceMiddleware } from './services/security/template-nonce.middleware';
import { SimpleAuthRoutes } from './api/routes/simple-auth.routes';
import { CSPRoutes } from './api/routes/csp.routes';

import { UploadRoutes } from './api/routes/upload.routes';
import { DocumentationRoutes } from './api/routes/documentation.routes';
import { modelsRouter } from './api/routes/models.routes';
import { PredictionRoutes } from './api/routes/prediction.routes';
import monitoringRoutes from './api/routes/monitoring.routes';
import { requestLogger, performanceMonitor } from './services/monitoring';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { getCSPConfig } from './config/csp.config';
import { getTemplateNonceConfig } from './config/template-nonce.config';

class App {
  public app: express.Application;
  private dbManager: DatabaseManager;
  private rateLimitMiddleware: RateLimitMiddleware;
  private queueMiddleware: RequestQueueMiddleware;
  private cspMiddleware: CSPMiddleware;
  private nonceService: NonceService;
  private templateNonceMiddleware: TemplateNonceMiddleware;

  constructor() {
    this.app = express();
    const env = process.env.NODE_ENV || 'development';
    const config = databaseConfig[env];
    if (!config) {
      throw new Error(`Database configuration not found for environment: ${env}`);
    }
    this.dbManager = new DatabaseManager(config);
    this.rateLimitMiddleware = new RateLimitMiddleware();
    this.queueMiddleware = new RequestQueueMiddleware({
      maxQueueSize: 100,
      defaultTimeout: 30000,
      concurrentRequests: 20
    });
    
    // Initialize CSP middleware
    const cspConfig = getCSPConfig();
    this.cspMiddleware = new CSPMiddleware(cspConfig);
    this.nonceService = new NonceService({
      length: cspConfig.nonce.length,
      algorithm: cspConfig.nonce.algorithm,
      regenerateOnRequest: true
    });
    
    // Initialize template nonce middleware
    const templateConfig = getTemplateNonceConfig();
    this.templateNonceMiddleware = new TemplateNonceMiddleware(this.nonceService, templateConfig);
    
    this.initializeMiddlewares();
  }

  private initializeMiddlewares(): void {
    // Use helmet without CSP (we'll handle CSP separately)
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable helmet's CSP
    }));
    
    // Apply our custom CSP middleware
    this.app.use(this.cspMiddleware.middleware());
    
    this.app.use(cors());
    
    // Apply template nonce middleware before static files
    this.app.use(this.templateNonceMiddleware.middleware());
    
    // Add monitoring middleware
    this.app.use(requestLogger.logRequests());
    // Temporarily disabled: this.app.use(performanceMonitor.monitorHttpRequests());
    
    // Apply global rate limiting first
    this.app.use(this.rateLimitMiddleware.globalRateLimit());
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Add error logging middleware
    this.app.use(requestLogger.logErrors());
  }

  private initializeStaticFiles(): void {
    // Serve static files ONLY for specific paths, NOT for API routes
    // This should be called AFTER API routes are set up
    
    // Serve JS files
    this.app.use('/js', express.static('public/js'));
    
    // Serve CSS files  
    this.app.use('/styles', express.static('public/styles'));
    
    // Serve other static assets (but not HTML files and not API routes)
    this.app.use(express.static('public', {
      index: false, // Don't serve index.html automatically
      setHeaders: (res, path) => {
        if (path.endsWith('.html') || path.endsWith('.htm')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
  }

  private async initializeRoutes(): Promise<void> {
    try {
      console.log('Starting route initialization...');
      
      // Add a simple test route to verify API is working
      console.log('Adding test route...');
      this.app.get('/api/test', (req, res) => {
        res.json({ 
          message: 'API is working', 
          timestamp: new Date().toISOString(),
          routes: ['auth', 'models', 'predict', 'docs', 'monitoring']
        });
      });
      console.log('Test route added successfully');

      // Mount basic model routes first (without complex dependencies)
      console.log('Mounting model management routes...');
      this.app.use('/api/models', modelsRouter);
      console.log('Model management routes mounted successfully');

      // Mount monitoring routes
      console.log('Mounting monitoring routes...');
      this.app.use('/api/monitoring', monitoringRoutes);
      console.log('Monitoring routes mounted successfully');

      // Initialize database connection for other routes
      console.log('Initializing database connection...');
      await this.dbManager.initialize();
      console.log('Database initialized successfully');

      // Initialize repositories and services
      console.log('Creating repositories...');
      const userRepository = new UserRepository(this.dbManager.getConnection());
      const apiKeyRepository = new ApiKeyRepository(this.dbManager.getConnection());
      console.log('Repositories created successfully');

      console.log('Creating services...');
      const userService = new UserManagementService(userRepository);
      const apiKeyService = new ApiKeyService(apiKeyRepository, userRepository);
      const authMiddleware = new AuthMiddleware(userService, apiKeyService);
      console.log('Services created successfully');

      // Initialize routes
      console.log('Initializing auth routes...');
      const authRoutes = new SimpleAuthRoutes(this.dbManager.getConnection());
      console.log('Auth routes created successfully');
      
      console.log('Initializing other routes...');
      const { ApiKeyRoutes } = await import('./api/routes/api-key.routes');
      const apiKeyRoutes = new ApiKeyRoutes(apiKeyService, authMiddleware);
      const uploadRoutes = new UploadRoutes(authMiddleware);
      const documentationRoutes = new DocumentationRoutes(authMiddleware);
      const predictionRoutes = new PredictionRoutes(authMiddleware);
      const cspRoutes = new CSPRoutes(this.cspMiddleware);
      console.log('Other routes created successfully');

      // Mount routes with rate limiting and queuing
      console.log('Mounting auth routes...');
      this.app.use('/api/auth', authRoutes.getRouter());
      console.log('Auth routes mounted successfully');
      
      console.log('Mounting API key routes...');
      this.app.use('/api/auth/api-keys', apiKeyRoutes.getRouter());
      console.log('API key routes mounted successfully');
      
      console.log('Mounting upload routes...');
      this.app.use('/api/upload', 
        this.rateLimitMiddleware.uploadRateLimit(), 
        this.queueMiddleware.uploadQueue(), 
        uploadRoutes.getRouter()
      );
      console.log('Upload routes mounted successfully');
      
      console.log('Mounting prediction routes...');
      this.app.use('/api/predict', 
        this.rateLimitMiddleware.predictionRateLimit(), 
        this.queueMiddleware.predictionQueue(), 
        predictionRoutes.getRouter()
      );
      console.log('Prediction routes mounted successfully');

    // Documentation routes (no rate limiting for docs)
    this.app.use('/api/docs', documentationRoutes.getRouter());

    // CSP routes (no rate limiting for CSP violation reports)
    this.app.use('/api/csp', cspRoutes.getRouter());

    // Rate limit management endpoints
    this.app.get('/api/rate-limit/info', authMiddleware.authenticateJWT, this.rateLimitMiddleware.getRateLimitInfo());
    this.app.post('/api/rate-limit/reset/:userId', authMiddleware.authenticateJWT, this.rateLimitMiddleware.resetUserRateLimit());
    this.app.get('/api/rate-limit/stats', this.rateLimitMiddleware.getStats());

    // Queue management endpoints
    this.app.get('/api/queue/status', this.queueMiddleware.getQueueStatus());
    this.app.post('/api/queue/clear', authMiddleware.authenticateJWT, this.queueMiddleware.clearQueue());
    this.app.put('/api/queue/config', authMiddleware.authenticateJWT, this.queueMiddleware.updateQueueConfig());
    this.app.get('/api/queue/health', this.queueMiddleware.healthCheck());

    // Health check endpoint with queue status
    const healthHandler = (req: express.Request, res: express.Response) => {
      const queueStats = this.queueMiddleware.getQueueService().getStats();
      const isHealthy = queueStats.queueSize < 50 && queueStats.activeRequests < 15;
      
      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        queue: {
          size: queueStats.queueSize,
          activeRequests: queueStats.activeRequests,
          averageWaitTime: queueStats.averageWaitTime
        }
      });
    };

    // Mount health endpoint at both locations
    this.app.get('/health', healthHandler);
    this.app.get('/api/health', healthHandler);

    // API info endpoint - MUST be before static files
    this.app.get('/api', (req, res) => {
      res.json({
        message: 'ML Model Upload API',
        version: '1.0.0',
        endpoints: {
          auth: '/api/auth',
          apiKeys: '/api/keys',
          upload: '/api/upload',
          models: '/api/models',
          predict: '/api/predict',
          documentation: '/docs/api-docs',
          monitoring: '/api/monitoring',
          rateLimits: '/api/rate-limit',
          queue: '/api/queue',
          health: '/health'
        }
      });
    });

    console.log('✅ All API routes mounted successfully');

    // Serve dashboard for root and dashboard routes BEFORE static files
    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });

    this.app.get('/dashboard', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });

    this.app.get('/upload', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });

    this.app.get('/models', (req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });
    
    // Initialize static file serving AFTER ALL routes (including HTML routes)
    this.initializeStaticFiles();
    console.log('✅ Static file serving initialized');

    // Initialize error handling after all routes are set up
    console.log('Initializing error handling...');
    this.initializeErrorHandling();
    console.log('Error handling initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize routes:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown'
      });
      throw error;
    }
  }

  private initializeErrorHandling(): void {
    // API 404 handler - only for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `API route ${req.originalUrl} not found`,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Non-API 404 handler - serve index.html for SPA routing
    this.app.use('*', (req, res) => {
      // For non-API routes, serve the main app (SPA routing)
      res.sendFile('index.html', { root: 'public' });
    });

    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error);
      
      res.status(error.status || 500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      });
    });
  }

  public async start(): Promise<void> {
    // Initialize routes after database is ready
    await this.initializeRoutes();
    
    const port = appConfig.port || 3000;
    
    this.app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📚 API Documentation: http://localhost:${port}/`);
      console.log(`🔐 Auth endpoints: http://localhost:${port}/api/auth`);
      console.log(`🔑 API Key endpoints: http://localhost:${port}/api/keys`);
      console.log(`📤 Upload endpoints: http://localhost:${port}/api/upload`);
      console.log(`📊 Model endpoints: http://localhost:${port}/api/models`);
      console.log(`🔮 Prediction endpoints: http://localhost:${port}/api/predict`);
    });
  }

  public async close(): Promise<void> {
    await this.dbManager.close();
    this.rateLimitMiddleware.destroy();
    this.queueMiddleware.destroy();
    // CSP middleware doesn't need explicit cleanup
  }
}

// Start the application
if (require.main === module) {
  const app = new App();
  app.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

export default App;