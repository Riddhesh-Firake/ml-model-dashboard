import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../../services/documentation/swagger.config';
import { DocumentationService } from '../../services/documentation/documentation.service';
import { TestingInterfaceService } from '../../services/documentation/testing-interface.service';
import { DashboardService } from '../../services/documentation/dashboard.service';
import { ModelManagementService } from '../../services/model-management';
import { InferenceService } from '../../services/inference';
import { AuthMiddleware } from '../../services/user-management/auth.middleware';
import { DatabaseManager } from '../../database/database.manager';
import { databaseConfig } from '../../config';

export class DocumentationRoutes {
  private router: Router;
  private documentationService: DocumentationService;
  private testingInterfaceService: TestingInterfaceService;
  private dashboardService: DashboardService;
  private modelService: ModelManagementService;

  constructor(authMiddleware: AuthMiddleware) {
    this.router = Router();
    
    // Initialize services
    const env = process.env.NODE_ENV || 'development';
    const dbManager = new DatabaseManager(databaseConfig[env]!);
    const inferenceService = new InferenceService();
    this.modelService = new ModelManagementService(dbManager.getConnection());
    this.documentationService = new DocumentationService(inferenceService);
    this.testingInterfaceService = new TestingInterfaceService(this.documentationService, inferenceService);
    this.dashboardService = new DashboardService();
    
    this.setupRoutes(authMiddleware);
  }

  private setupRoutes(authMiddleware: AuthMiddleware): void {
    // Root documentation endpoint
    this.router.get('/', (req: Request, res: Response) => {
      res.json({
        title: 'ML Model Upload API Documentation',
        version: '1.0.0',
        description: 'API for uploading, managing, and running ML models',
        endpoints: {
          swagger: '/api/docs/api-docs',
          openapi: '/api/docs/api-docs.json',
          testing: '/api/docs/testing',
          models: '/api/docs/models'
        },
        links: {
          interactive: '/api/docs/api-docs',
          health: '/api/monitoring/health',
          metrics: '/api/monitoring/metrics'
        }
      });
    });

    // Serve main API documentation
    this.router.use('/api-docs', swaggerUi.serve);
    this.router.get('/api-docs', swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'ML Model Upload API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true
      }
    }));

    // Get OpenAPI JSON specification
    this.router.get('/api-docs.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // Get documentation for a specific model
    this.router.get('/models/:modelId/docs', 
      authMiddleware.authenticateAny, 
      this.getModelDocumentation.bind(this)
    );

    // Get OpenAPI spec for a specific model
    this.router.get('/models/:modelId/openapi.json', 
      authMiddleware.authenticateAny, 
      this.getModelOpenAPISpec.bind(this)
    );

    // Serve interactive documentation for a specific model
    this.router.get('/models/:modelId/docs/interactive', 
      authMiddleware.authenticateAny, 
      this.serveModelInteractiveDocs.bind(this)
    );

    // Get all models documentation (for authenticated user)
    this.router.get('/models', 
      authMiddleware.authenticateAny, 
      this.getAllModelsDocumentation.bind(this)
    );

    // Testing interface endpoint
    this.router.get('/testing', (req: Request, res: Response) => {
      res.json({
        title: 'API Testing Interface',
        description: 'Interactive testing interface for ML Model Upload API',
        version: '1.0.0',
        features: [
          'Interactive API testing',
          'Request/response examples',
          'Schema validation',
          'Authentication testing'
        ],
        endpoints: {
          swagger: '/api/docs/api-docs',
          models: '/api/docs/models',
          health: '/api/monitoring/health'
        },
        usage: {
          authentication: 'Use Bearer token or X-API-Key header',
          baseUrl: req.protocol + '://' + req.get('host'),
          examples: {
            register: 'POST /api/auth/register',
            upload: 'POST /api/models/upload',
            predict: 'POST /api/predict/:modelId'
          }
        }
      });
    });

    // Health check endpoint for documentation service
    this.router.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: 'documentation',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });
  }

  /**
   * Get comprehensive documentation for a specific model
   */
  private async getModelDocumentation(req: Request, res: Response): Promise<void> {
    try {
      const { modelId } = req.params;
      const userId = req.user?.userId;

      if (!modelId) {
        res.status(400).json({
          error: {
            code: 'MISSING_MODEL_ID',
            message: 'Model ID is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Get model and verify ownership
      const model = await this.modelService.getModel(modelId);
      if (!model) {
        res.status(404).json({
          error: {
            code: 'MODEL_NOT_FOUND',
            message: 'Model not found',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (model.userId !== userId) {
        res.status(404).json({
          error: {
            code: 'MODEL_NOT_FOUND',
            message: 'Model not found or access denied',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generate documentation
      const documentation = await this.documentationService.generateModelDocumentation(model);

      res.json({
        documentation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting model documentation:', error);
      res.status(500).json({
        error: {
          code: 'DOCUMENTATION_ERROR',
          message: 'Failed to generate model documentation',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get OpenAPI specification for a specific model
   */
  private async getModelOpenAPISpec(req: Request, res: Response): Promise<void> {
    try {
      const { modelId } = req.params;
      const userId = req.user?.userId;

      if (!modelId) {
        res.status(400).json({
          error: {
            code: 'MISSING_MODEL_ID',
            message: 'Model ID is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Get model and verify ownership
      const model = await this.modelService.getModel(modelId);
      if (!model || model.userId !== userId) {
        res.status(404).json({
          error: {
            code: 'MODEL_NOT_FOUND',
            message: 'Model not found or access denied',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generate documentation and OpenAPI spec
      const documentation = await this.documentationService.generateModelDocumentation(model);
      const openApiSpec = this.documentationService.generateModelOpenAPISpec(model, documentation);

      res.setHeader('Content-Type', 'application/json');
      res.json(openApiSpec);

    } catch (error) {
      console.error('Error getting model OpenAPI spec:', error);
      res.status(500).json({
        error: {
          code: 'OPENAPI_ERROR',
          message: 'Failed to generate OpenAPI specification',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Serve interactive Swagger UI for a specific model
   */
  private async serveModelInteractiveDocs(req: Request, res: Response): Promise<void> {
    try {
      const { modelId } = req.params;
      const userId = req.user?.userId;

      // Get model and verify ownership
      const model = await this.modelService.getModel(modelId);
      if (!model || model.userId !== userId) {
        res.status(404).send(`
          <html>
            <head><title>Model Not Found</title></head>
            <body>
              <h1>Model Not Found</h1>
              <p>The requested model was not found or you don't have access to it.</p>
            </body>
          </html>
        `);
        return;
      }

      // Generate documentation and OpenAPI spec
      const documentation = await this.documentationService.generateModelDocumentation(model);
      const openApiSpec = this.documentationService.generateModelOpenAPISpec(model, documentation);

      // Generate custom Swagger UI HTML
      const swaggerHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${model.name} API Documentation</title>
            <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
            <style>
              .swagger-ui .topbar { display: none; }
              .swagger-ui .info { margin-bottom: 20px; }
              .model-info {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 4px;
                padding: 15px;
                margin-bottom: 20px;
              }
              .usage-examples {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 4px;
                padding: 15px;
                margin-top: 20px;
              }
              .usage-examples pre {
                background: #ffffff;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 10px;
                margin: 10px 0;
                overflow-x: auto;
              }
            </style>
          </head>
          <body>
            <div id="swagger-ui"></div>
            
            <div class="model-info">
              <h3>Model Information</h3>
              <p><strong>Name:</strong> ${model.name}</p>
              <p><strong>Description:</strong> ${documentation.description}</p>
              <p><strong>Format:</strong> ${model.fileFormat}</p>
              <p><strong>Endpoint:</strong> <code>${documentation.endpointUrl}</code></p>
              <p><strong>Created:</strong> ${new Date(model.createdAt).toLocaleString()}</p>
            </div>

            <div class="usage-examples">
              <h3>Usage Examples</h3>
              
              <h4>cURL</h4>
              <pre><code>${documentation.usage.curl}</code></pre>
              
              <h4>JavaScript</h4>
              <pre><code>${documentation.usage.javascript}</code></pre>
              
              <h4>Python</h4>
              <pre><code>${documentation.usage.python}</code></pre>
            </div>

            <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
            <script>
              SwaggerUIBundle({
                url: '/docs/models/${modelId}/openapi.json',
                dom_id: '#swagger-ui',
                presets: [
                  SwaggerUIBundle.presets.apis,
                  SwaggerUIBundle.presets.standalone
                ],
                layout: "BaseLayout",
                deepLinking: true,
                showExtensions: true,
                showCommonExtensions: true,
                displayRequestDuration: true
              });
            </script>
          </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(swaggerHtml);

    } catch (error) {
      console.error('Error serving model interactive docs:', error);
      res.status(500).send(`
        <html>
          <head><title>Documentation Error</title></head>
          <body>
            <h1>Documentation Error</h1>
            <p>Failed to generate interactive documentation for this model.</p>
          </body>
        </html>
      `);
    }
  }

  /**
   * Get documentation for all user models
   */
  private async getAllModelsDocumentation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Get all user models
      const models = await this.modelService.getUserModels(userId);

      // Generate basic documentation info for each model
      const modelsDocumentation = await Promise.all(
        models.map(async (model) => {
          try {
            const documentation = await this.documentationService.generateModelDocumentation(model);
            return {
              modelId: model.id,
              name: model.name,
              description: documentation.description,
              endpointUrl: documentation.endpointUrl,
              status: model.status,
              createdAt: model.createdAt,
              requestCount: model.requestCount,
              docsUrl: `/docs/models/${model.id}/docs`,
              interactiveDocsUrl: `/docs/models/${model.id}/docs/interactive`
            };
          } catch (error) {
            console.error(`Error generating docs for model ${model.id}:`, error);
            return {
              modelId: model.id,
              name: model.name,
              description: model.description || 'No description available',
              endpointUrl: model.endpointUrl,
              status: model.status,
              createdAt: model.createdAt,
              requestCount: model.requestCount,
              docsUrl: `/docs/models/${model.id}/docs`,
              interactiveDocsUrl: `/docs/models/${model.id}/docs/interactive`,
              error: 'Documentation generation failed'
            };
          }
        })
      );

      res.json({
        models: modelsDocumentation,
        total: modelsDocumentation.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting all models documentation:', error);
      res.status(500).json({
        error: {
          code: 'DOCUMENTATION_ERROR',
          message: 'Failed to retrieve models documentation',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}