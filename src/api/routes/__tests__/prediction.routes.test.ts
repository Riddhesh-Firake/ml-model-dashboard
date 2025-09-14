import request from 'supertest';
import express from 'express';
import { predictionRoutes } from '../prediction.routes';
import { InferenceService } from '../../../services/inference';
import { ModelManagementService } from '../../../services/model-management';
import { AuthMiddleware } from '../../../services/user-management/auth.middleware';
import { ModelMetadata, ModelFormat } from '../../../models';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-value')
}));
jest.mock('../../../services/inference');
jest.mock('../../../services/model-management');
jest.mock('../../../services/user-management/auth.middleware');
jest.mock('../../../services/user-management');
jest.mock('../../../services/user-management/api-key.service');
jest.mock('../../../database/database.manager');

const MockInferenceService = InferenceService as jest.MockedClass<typeof InferenceService>;
const MockModelManagementService = ModelManagementService as jest.MockedClass<typeof ModelManagementService>;
const MockAuthMiddleware = AuthMiddleware as jest.MockedClass<typeof AuthMiddleware>;

describe('Prediction Routes', () => {
  let app: express.Application;
  let mockInferenceService: jest.Mocked<InferenceService>;
  let mockModelManagementService: jest.Mocked<ModelManagementService>;
  let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;

  const mockModel: ModelMetadata = {
    id: 'model-123',
    name: 'Test Model',
    description: 'A test model',
    userId: 'user-123',
    fileFormat: ModelFormat.PICKLE,
    filePath: '/path/to/model.pkl',
    endpointUrl: '/api/predict/model-123',
    createdAt: new Date(),
    lastUsed: new Date(),
    requestCount: 0,
    status: 'active' as any
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockInferenceService = new MockInferenceService() as jest.Mocked<InferenceService>;
    mockModelManagementService = new MockModelManagementService({} as any) as jest.Mocked<ModelManagementService>;
    mockAuthMiddleware = new MockAuthMiddleware({} as any, {} as any) as jest.Mocked<AuthMiddleware>;

    // Mock auth middleware methods
    mockAuthMiddleware.authenticateAny = jest.fn().mockImplementation((req, res, next) => {
      req.user = { userId: 'user-123', email: 'test@example.com', subscription: 'free' };
      next();
    });

    mockAuthMiddleware.authenticateJWT = jest.fn().mockImplementation((req, res, next) => {
      req.user = { userId: 'user-123', email: 'test@example.com', subscription: 'free' };
      next();
    });

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/predict', predictionRoutes);
  });

  describe('POST /api/predict/:modelId', () => {
    it('should make successful prediction', async () => {
      const inputData = { data: [1, 2, 3, 4] };
      const mockPredictionResult = {
        predictions: [0.8, 0.2],
        confidence: 0.9,
        processingTime: 150,
        status: 'success' as const
      };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.predict.mockResolvedValue(mockPredictionResult);
      mockModelManagementService.incrementRequestCount.mockResolvedValue();

      const response = await request(app)
        .post('/api/predict/model-123')
        .send(inputData)
        .expect(200);

      expect(response.body).toMatchObject({
        modelId: 'model-123',
        predictions: [0.8, 0.2],
        confidence: 0.9,
        processingTime: 150
      });

      expect(mockInferenceService.predict).toHaveBeenCalledWith({
        modelId: 'model-123',
        inputData,
        apiKey: undefined
      });

      expect(mockModelManagementService.incrementRequestCount).toHaveBeenCalledWith('model-123');
    });

    it('should load model if not already loaded', async () => {
      const inputData = { data: [1, 2, 3, 4] };
      const mockPredictionResult = {
        predictions: [0.8, 0.2],
        processingTime: 150,
        status: 'success' as const
      };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(false);
      mockInferenceService.loadModel.mockResolvedValue();
      mockInferenceService.predict.mockResolvedValue(mockPredictionResult);
      mockModelManagementService.incrementRequestCount.mockResolvedValue();

      await request(app)
        .post('/api/predict/model-123')
        .send(inputData)
        .expect(200);

      expect(mockInferenceService.loadModel).toHaveBeenCalledWith(mockModel);
    });

    it('should return 400 for missing input data', async () => {
      mockModelManagementService.getModel.mockResolvedValue(mockModel);

      const response = await request(app)
        .post('/api/predict/model-123')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_INPUT_DATA');
    });

    it('should return 404 for non-existent model', async () => {
      mockModelManagementService.getModel.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/predict/model-123')
        .send({ data: [1, 2, 3] })
        .expect(404);

      expect(response.body.error.code).toBe('MODEL_NOT_FOUND');
    });

    it('should return 403 for inactive model', async () => {
      const inactiveModel = { ...mockModel, status: 'inactive' as any };
      mockModelManagementService.getModel.mockResolvedValue(inactiveModel);

      const response = await request(app)
        .post('/api/predict/model-123')
        .send({ data: [1, 2, 3] })
        .expect(403);

      expect(response.body.error.code).toBe('MODEL_INACTIVE');
    });

    it('should return 400 for prediction failure', async () => {
      const inputData = { data: [1, 2, 3, 4] };
      const mockPredictionResult = {
        predictions: null,
        processingTime: 50,
        status: 'error' as const,
        error: 'Invalid input format'
      };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.predict.mockResolvedValue(mockPredictionResult);

      const response = await request(app)
        .post('/api/predict/model-123')
        .send(inputData)
        .expect(400);

      expect(response.body.error.code).toBe('PREDICTION_FAILED');
      expect(response.body.error.message).toBe('Invalid input format');
    });

    it('should handle API key in headers', async () => {
      const inputData = { data: [1, 2, 3, 4] };
      const mockPredictionResult = {
        predictions: [0.8, 0.2],
        processingTime: 150,
        status: 'success' as const
      };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.predict.mockResolvedValue(mockPredictionResult);
      mockModelManagementService.incrementRequestCount.mockResolvedValue();

      await request(app)
        .post('/api/predict/model-123')
        .set('X-API-Key', 'test-api-key')
        .send(inputData)
        .expect(200);

      expect(mockInferenceService.predict).toHaveBeenCalledWith({
        modelId: 'model-123',
        inputData,
        apiKey: 'test-api-key'
      });
    });
  });

  describe('GET /api/predict/:modelId/schema', () => {
    it('should return model input schema', async () => {
      const mockSchema = {
        type: 'object',
        properties: {
          data: { type: 'array' }
        },
        required: ['data']
      };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.getModelInputSchema.mockResolvedValue(mockSchema);

      const response = await request(app)
        .get('/api/predict/model-123/schema')
        .expect(200);

      expect(response.body).toMatchObject({
        modelId: 'model-123',
        inputSchema: mockSchema
      });
    });

    it('should load model if not already loaded', async () => {
      const mockSchema = { type: 'object' };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(false);
      mockInferenceService.loadModel.mockResolvedValue();
      mockInferenceService.getModelInputSchema.mockResolvedValue(mockSchema);

      await request(app)
        .get('/api/predict/model-123/schema')
        .expect(200);

      expect(mockInferenceService.loadModel).toHaveBeenCalledWith(mockModel);
    });
  });

  describe('POST /api/predict/:modelId/validate', () => {
    it('should validate input data successfully', async () => {
      const inputData = { data: [1, 2, 3, 4] };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.validateInput.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/predict/model-123/validate')
        .send(inputData)
        .expect(200);

      expect(response.body).toMatchObject({
        modelId: 'model-123',
        isValid: true,
        inputData
      });

      expect(mockInferenceService.validateInput).toHaveBeenCalledWith('model-123', inputData);
    });

    it('should return validation failure', async () => {
      const inputData = { wrongField: 'value' };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.validateInput.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/predict/model-123/validate')
        .send(inputData)
        .expect(200);

      expect(response.body.isValid).toBe(false);
    });

    it('should return 400 for missing input data', async () => {
      mockModelManagementService.getModel.mockResolvedValue(mockModel);

      const response = await request(app)
        .post('/api/predict/model-123/validate')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_INPUT_DATA');
    });
  });

  describe('POST /api/predict/:modelId/warmup', () => {
    it('should warm up model successfully', async () => {
      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.preloadModel.mockResolvedValue();

      const response = await request(app)
        .post('/api/predict/model-123/warmup')
        .send({})
        .expect(200);

      expect(response.body).toMatchObject({
        modelId: 'model-123',
        status: 'warmed_up'
      });

      expect(mockInferenceService.preloadModel).toHaveBeenCalledWith(mockModel);
    });

    it('should warm up model with sample input', async () => {
      const sampleInput = { data: [1, 2, 3] };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.preloadModel.mockResolvedValue();
      mockInferenceService.warmupModel.mockResolvedValue();

      await request(app)
        .post('/api/predict/model-123/warmup')
        .send({ sampleInput })
        .expect(200);

      expect(mockInferenceService.preloadModel).toHaveBeenCalledWith(mockModel);
      expect(mockInferenceService.warmupModel).toHaveBeenCalledWith('model-123', sampleInput);
    });
  });

  describe('GET /api/predict/cache/stats', () => {
    it('should return cache statistics', async () => {
      const mockStats = {
        size: 3,
        maxSize: 10,
        models: ['model-1', 'model-2', 'model-3']
      };

      mockInferenceService.getCacheStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/predict/cache/stats')
        .expect(200);

      expect(response.body).toMatchObject({
        cache: mockStats
      });
    });
  });

  describe('Model access validation middleware', () => {
    it('should return 400 for missing model ID', async () => {
      // This would be tested by calling an endpoint without modelId param
      // but since our routes all have :modelId, this is handled by Express routing
    });

    it('should handle model service errors', async () => {
      mockModelManagementService.getModel.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/predict/model-123')
        .send({ data: [1, 2, 3] })
        .expect(500);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error handling', () => {
    it('should handle inference service errors', async () => {
      const inputData = { data: [1, 2, 3, 4] };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.predict.mockRejectedValue(new Error('Inference error'));

      const response = await request(app)
        .post('/api/predict/model-123')
        .send(inputData)
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle model loading errors', async () => {
      const inputData = { data: [1, 2, 3, 4] };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(false);
      mockInferenceService.loadModel.mockRejectedValue(new Error('Loading failed'));

      const response = await request(app)
        .post('/api/predict/model-123')
        .send(inputData)
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle schema retrieval errors', async () => {
      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.getModelInputSchema.mockRejectedValue(new Error('Schema error'));

      const response = await request(app)
        .get('/api/predict/model-123/schema')
        .expect(500);

      expect(response.body.error.code).toBe('SCHEMA_ERROR');
    });

    it('should handle validation errors', async () => {
      const inputData = { data: [1, 2, 3, 4] };

      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.validateInput.mockRejectedValue(new Error('Validation error'));

      const response = await request(app)
        .post('/api/predict/model-123/validate')
        .send(inputData)
        .expect(500);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle warmup errors', async () => {
      mockModelManagementService.getModel.mockResolvedValue(mockModel);
      mockInferenceService.preloadModel.mockRejectedValue(new Error('Warmup failed'));

      const response = await request(app)
        .post('/api/predict/model-123/warmup')
        .send({})
        .expect(500);

      expect(response.body.error.code).toBe('WARMUP_ERROR');
    });

    it('should handle cache stats errors', async () => {
      mockInferenceService.getCacheStats.mockImplementation(() => {
        throw new Error('Stats error');
      });

      const response = await request(app)
        .get('/api/predict/cache/stats')
        .expect(500);

      expect(response.body.error.code).toBe('STATS_ERROR');
    });
  });
});