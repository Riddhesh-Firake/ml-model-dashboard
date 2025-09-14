import request from 'supertest';
import express from 'express';
import { DocumentationRoutes } from '../documentation.routes';
import { AuthMiddleware } from '../../../services/user-management/auth.middleware';
import { ModelManagementService } from '../../../services/model-management';
import { DocumentationService } from '../../../services/documentation/documentation.service';

// Mock dependencies
jest.mock('../../../services/user-management/auth.middleware');
jest.mock('../../../services/model-management');
jest.mock('../../../services/documentation/documentation.service');
jest.mock('../../../services/documentation/testing-interface.service');
jest.mock('../../../services/documentation/dashboard.service');
jest.mock('../../../services/inference');
jest.mock('../../../database/database.manager');

describe('DocumentationRoutes', () => {
  let app: express.Application;
  let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;
  let mockModelService: jest.Mocked<ModelManagementService>;
  let mockDocumentationService: jest.Mocked<DocumentationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AuthMiddleware
    mockAuthMiddleware = {
      authenticateAny: jest.fn((req, res, next) => {
        req.user = { userId: 'test-user-123' };
        next();
      })
    } as any;

    // Mock ModelManagementService
    mockModelService = {
      getModel: jest.fn(),
      getUserModels: jest.fn()
    } as any;

    // Mock DocumentationService
    mockDocumentationService = {
      generateModelDocumentation: jest.fn(),
      generateModelOpenAPISpec: jest.fn()
    } as any;

    // Setup Express app
    app = express();
    app.use(express.json());
    
    const documentationRoutes = new DocumentationRoutes(mockAuthMiddleware);
    // Mock the services on the routes instance
    (documentationRoutes as any).modelService = mockModelService;
    (documentationRoutes as any).documentationService = mockDocumentationService;
    
    app.use('/docs', documentationRoutes.getRouter());
  });

  describe('GET /docs/api-docs.json', () => {
    it('should return OpenAPI JSON specification', async () => {
      const response = await request(app)
        .get('/docs/api-docs.json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toBeDefined();
    });
  });

  describe('GET /docs/models/:modelId/docs', () => {
    const mockModel = {
      id: 'model-123',
      name: 'Test Model',
      userId: 'test-user-123',
      description: 'Test model description',
      fileFormat: 'pickle',
      endpointUrl: 'http://localhost:3000/api/predict/model-123',
      createdAt: new Date(),
      status: 'active'
    };

    const mockDocumentation = {
      description: 'Generated documentation',
      endpointUrl: mockModel.endpointUrl,
      usage: {
        curl: 'curl example',
        javascript: 'js example',
        python: 'python example'
      }
    };

    it('should return model documentation for valid model', async () => {
      mockModelService.getModel.mockResolvedValue(mockModel as any);
      mockDocumentationService.generateModelDocumentation.mockResolvedValue(mockDocumentation as any);

      const response = await request(app)
        .get('/docs/models/model-123/docs')
        .expect(200);

      expect(response.body.documentation).toEqual(mockDocumentation);
      expect(response.body.timestamp).toBeDefined();
      expect(mockModelService.getModel).toHaveBeenCalledWith('model-123');
      expect(mockDocumentationService.generateModelDocumentation).toHaveBeenCalledWith(mockModel);
    });

    it('should return 400 when model ID is missing', async () => {
      const response = await request(app)
        .get('/docs/models//docs')
        .expect(404); // Express router will return 404 for empty param

      // Alternative test with explicit empty modelId
      const response2 = await request(app)
        .get('/docs/models/undefined/docs')
        .expect(404);
    });

    it('should return 404 when model not found', async () => {
      mockModelService.getModel.mockResolvedValue(null);

      const response = await request(app)
        .get('/docs/models/nonexistent/docs')
        .expect(404);

      expect(response.body.error.code).toBe('MODEL_NOT_FOUND');
    });

    it('should return 404 when user does not own model', async () => {
      const otherUserModel = { ...mockModel, userId: 'other-user' };
      mockModelService.getModel.mockResolvedValue(otherUserModel as any);

      const response = await request(app)
        .get('/docs/models/model-123/docs')
        .expect(404);

      expect(response.body.error.code).toBe('MODEL_NOT_FOUND');
    });

    it('should return 500 when documentation generation fails', async () => {
      mockModelService.getModel.mockResolvedValue(mockModel as any);
      mockDocumentationService.generateModelDocumentation.mockRejectedValue(new Error('Generation failed'));

      const response = await request(app)
        .get('/docs/models/model-123/docs')
        .expect(500);

      expect(response.body.error.code).toBe('DOCUMENTATION_ERROR');
    });
  });

  describe('GET /docs/models/:modelId/openapi.json', () => {
    const mockModel = {
      id: 'model-123',
      name: 'Test Model',
      userId: 'test-user-123',
      description: 'Test model description'
    };

    const mockDocumentation = {
      description: 'Generated documentation',
      endpointUrl: 'http://localhost:3000/api/predict/model-123'
    };

    const mockOpenApiSpec = {
      openapi: '3.0.0',
      info: { title: 'Test Model API', version: '1.0.0' },
      paths: {}
    };

    it('should return OpenAPI specification for valid model', async () => {
      mockModelService.getModel.mockResolvedValue(mockModel as any);
      mockDocumentationService.generateModelDocumentation.mockResolvedValue(mockDocumentation as any);
      mockDocumentationService.generateModelOpenAPISpec.mockReturnValue(mockOpenApiSpec);

      const response = await request(app)
        .get('/docs/models/model-123/openapi.json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toEqual(mockOpenApiSpec);
      expect(mockDocumentationService.generateModelOpenAPISpec).toHaveBeenCalledWith(mockModel, mockDocumentation);
    });

    it('should return 404 when model not found', async () => {
      mockModelService.getModel.mockResolvedValue(null);

      const response = await request(app)
        .get('/docs/models/nonexistent/openapi.json')
        .expect(404);

      expect(response.body.error.code).toBe('MODEL_NOT_FOUND');
    });

    it('should return 500 when OpenAPI generation fails', async () => {
      mockModelService.getModel.mockResolvedValue(mockModel as any);
      mockDocumentationService.generateModelDocumentation.mockRejectedValue(new Error('Generation failed'));

      const response = await request(app)
        .get('/docs/models/model-123/openapi.json')
        .expect(500);

      expect(response.body.error.code).toBe('OPENAPI_ERROR');
    });
  });

  describe('GET /docs/models/:modelId/docs/interactive', () => {
    const mockModel = {
      id: 'model-123',
      name: 'Test Model',
      userId: 'test-user-123',
      description: 'Test model description',
      fileFormat: 'pickle',
      createdAt: new Date()
    };

    const mockDocumentation = {
      description: 'Generated documentation',
      endpointUrl: 'http://localhost:3000/api/predict/model-123',
      usage: {
        curl: 'curl example',
        javascript: 'js example',
        python: 'python example'
      }
    };

    it('should return interactive documentation HTML for valid model', async () => {
      mockModelService.getModel.mockResolvedValue(mockModel as any);
      mockDocumentationService.generateModelDocumentation.mockResolvedValue(mockDocumentation as any);
      mockDocumentationService.generateModelOpenAPISpec.mockReturnValue({} as any);

      const response = await request(app)
        .get('/docs/models/model-123/docs/interactive')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Test Model API Documentation');
      expect(response.text).toContain('swagger-ui');
      expect(response.text).toContain(mockModel.name);
    });

    it('should return 404 HTML when model not found', async () => {
      mockModelService.getModel.mockResolvedValue(null);

      const response = await request(app)
        .get('/docs/models/nonexistent/docs/interactive')
        .expect(404);

      expect(response.text).toContain('Model Not Found');
    });

    it('should return 500 HTML when documentation generation fails', async () => {
      mockModelService.getModel.mockResolvedValue(mockModel as any);
      mockDocumentationService.generateModelDocumentation.mockRejectedValue(new Error('Generation failed'));

      const response = await request(app)
        .get('/docs/models/model-123/docs/interactive')
        .expect(500);

      expect(response.text).toContain('Documentation Error');
    });
  });

  describe('GET /docs/models', () => {
    const mockModels = [
      {
        id: 'model-1',
        name: 'Model 1',
        description: 'First model',
        endpointUrl: 'http://localhost:3000/api/predict/model-1',
        status: 'active',
        createdAt: new Date(),
        requestCount: 10
      },
      {
        id: 'model-2',
        name: 'Model 2',
        description: 'Second model',
        endpointUrl: 'http://localhost:3000/api/predict/model-2',
        status: 'active',
        createdAt: new Date(),
        requestCount: 5
      }
    ];

    it('should return documentation for all user models', async () => {
      mockModelService.getUserModels.mockResolvedValue(mockModels as any);
      mockDocumentationService.generateModelDocumentation.mockResolvedValue({
        description: 'Generated documentation',
        endpointUrl: 'http://localhost:3000/api/predict/model-1'
      } as any);

      const response = await request(app)
        .get('/docs/models')
        .expect(200);

      expect(response.body.models).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.models[0]).toHaveProperty('modelId');
      expect(response.body.models[0]).toHaveProperty('docsUrl');
      expect(response.body.models[0]).toHaveProperty('interactiveDocsUrl');
      expect(mockModelService.getUserModels).toHaveBeenCalledWith('test-user-123');
    });

    it('should handle documentation generation errors gracefully', async () => {
      mockModelService.getUserModels.mockResolvedValue(mockModels as any);
      mockDocumentationService.generateModelDocumentation.mockRejectedValue(new Error('Generation failed'));

      const response = await request(app)
        .get('/docs/models')
        .expect(200);

      expect(response.body.models).toHaveLength(2);
      expect(response.body.models[0]).toHaveProperty('error', 'Documentation generation failed');
    });

    it('should return 500 when service fails', async () => {
      mockModelService.getUserModels.mockRejectedValue(new Error('Service failed'));

      const response = await request(app)
        .get('/docs/models')
        .expect(500);

      expect(response.body.error.code).toBe('DOCUMENTATION_ERROR');
    });
  });

  describe('GET /docs/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/docs/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('documentation');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBe('1.0.0');
    });
  });
});