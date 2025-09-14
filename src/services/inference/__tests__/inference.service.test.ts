import { InferenceService } from '../inference.service';
import { ModelLoaderService } from '../model-loader.service';
import { ModelValidatorService } from '../model-validator.service';
import { PredictionRequest, ModelMetadata, ModelFormat } from '../../../models';

// Mock the dependencies
jest.mock('../model-loader.service');
jest.mock('../model-validator.service');

const MockModelLoaderService = ModelLoaderService as jest.MockedClass<typeof ModelLoaderService>;
const MockModelValidatorService = ModelValidatorService as jest.MockedClass<typeof ModelValidatorService>;

describe('InferenceService', () => {
  let service: InferenceService;
  let mockModelLoader: jest.Mocked<ModelLoaderService>;
  let mockModelValidator: jest.Mocked<ModelValidatorService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockModelLoader = new MockModelLoaderService() as jest.Mocked<ModelLoaderService>;
    mockModelValidator = new MockModelValidatorService() as jest.Mocked<ModelValidatorService>;
    
    service = new InferenceService();
    (service as any).modelLoader = mockModelLoader;
    (service as any).modelValidator = mockModelValidator;
  });

  describe('predict', () => {
    const mockRequest: PredictionRequest = {
      modelId: 'test-model-1',
      inputData: { data: [1, 2, 3, 4] }
    };

    const mockLoadedModel = {
      id: 'test-model-1',
      model: { mock: 'model' },
      format: ModelFormat.PICKLE,
      inputSchema: { type: 'object', properties: { data: { type: 'array' } } },
      loadedAt: new Date(),
      lastUsed: new Date()
    };

    it('should make successful prediction', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);
      mockModelValidator.validateInputData.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await service.predict(mockRequest);

      expect(result.status).toBe('success');
      expect(result.predictions).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      expect(mockModelLoader.getLoadedModel).toHaveBeenCalledWith(mockRequest.modelId);
      expect(mockModelValidator.validateInputData).toHaveBeenCalledWith(
        mockRequest.modelId,
        mockRequest.inputData,
        mockLoadedModel.inputSchema
      );
    });

    it('should return error when model is not loaded', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(undefined);

      const result = await service.predict(mockRequest);

      expect(result.status).toBe('error');
      expect(result.error).toContain('is not loaded');
      expect(result.predictions).toBeNull();
    });

    it('should return error when input validation fails', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);
      mockModelValidator.validateInputData.mockResolvedValue({
        isValid: false,
        errors: ['Invalid input format'],
        warnings: []
      });

      const result = await service.predict(mockRequest);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Input validation failed');
      expect(result.predictions).toBeNull();
    });

    it('should handle prediction execution errors', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);
      mockModelValidator.validateInputData.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // Mock the private executePrediction method to throw an error
      const originalExecutePrediction = (service as any).executePrediction;
      (service as any).executePrediction = jest.fn().mockRejectedValue(new Error('Prediction failed'));

      const result = await service.predict(mockRequest);

      expect(result.status).toBe('error');
      expect(result.error).toBe('Prediction failed');
      expect(result.predictions).toBeNull();

      // Restore original method
      (service as any).executePrediction = originalExecutePrediction;
    });
  });

  describe('loadModel', () => {
    const mockMetadata: ModelMetadata = {
      id: 'test-model-1',
      name: 'Test Model',
      description: 'A test model',
      userId: 'user-1',
      fileFormat: ModelFormat.PICKLE,
      filePath: '/path/to/model.pkl',
      endpointUrl: '/api/predict/test-model-1',
      createdAt: new Date(),
      lastUsed: new Date(),
      requestCount: 0,
      status: 'active' as any
    };

    it('should load model successfully', async () => {
      mockModelValidator.validateModel.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockModelLoader.loadModel.mockResolvedValue({
        id: mockMetadata.id,
        model: {},
        format: mockMetadata.fileFormat,
        loadedAt: new Date(),
        lastUsed: new Date()
      });

      await expect(service.loadModel(mockMetadata)).resolves.not.toThrow();

      expect(mockModelValidator.validateModel).toHaveBeenCalledWith(mockMetadata);
      expect(mockModelLoader.loadModel).toHaveBeenCalledWith(mockMetadata);
    });

    it('should throw error when validation fails', async () => {
      mockModelValidator.validateModel.mockResolvedValue({
        isValid: false,
        errors: ['Invalid model format'],
        warnings: []
      });

      await expect(service.loadModel(mockMetadata)).rejects.toThrow('Model validation failed');
      expect(mockModelLoader.loadModel).not.toHaveBeenCalled();
    });

    it('should handle loader errors', async () => {
      mockModelValidator.validateModel.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockModelLoader.loadModel.mockRejectedValue(new Error('Loading failed'));

      await expect(service.loadModel(mockMetadata)).rejects.toThrow('Loading failed');
    });

    it('should log warnings from validation', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockModelValidator.validateModel.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: ['Large model file']
      });
      mockModelLoader.loadModel.mockResolvedValue({
        id: mockMetadata.id,
        model: {},
        format: mockMetadata.fileFormat,
        loadedAt: new Date(),
        lastUsed: new Date()
      });

      await service.loadModel(mockMetadata);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('warnings:'),
        ['Large model file']
      );

      consoleSpy.mockRestore();
    });
  });

  describe('unloadModel', () => {
    it('should unload model successfully', async () => {
      mockModelLoader.unloadModel.mockResolvedValue();

      await expect(service.unloadModel('test-model')).resolves.not.toThrow();
      expect(mockModelLoader.unloadModel).toHaveBeenCalledWith('test-model');
    });

    it('should handle unload errors', async () => {
      mockModelLoader.unloadModel.mockRejectedValue(new Error('Unload failed'));

      await expect(service.unloadModel('test-model')).rejects.toThrow('Unload failed');
    });
  });

  describe('isModelLoaded', () => {
    it('should return loader result', () => {
      mockModelLoader.isModelLoaded.mockReturnValue(true);

      const result = service.isModelLoaded('test-model');

      expect(result).toBe(true);
      expect(mockModelLoader.isModelLoaded).toHaveBeenCalledWith('test-model');
    });
  });

  describe('validateInput', () => {
    const mockLoadedModel = {
      id: 'test-model',
      model: {},
      format: ModelFormat.PICKLE,
      inputSchema: { type: 'object' },
      loadedAt: new Date(),
      lastUsed: new Date()
    };

    it('should validate input successfully', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);
      mockModelValidator.validateInputData.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await service.validateInput('test-model', { data: [1, 2, 3] });

      expect(result).toBe(true);
      expect(mockModelValidator.validateInputData).toHaveBeenCalledWith(
        'test-model',
        { data: [1, 2, 3] },
        mockLoadedModel.inputSchema
      );
    });

    it('should return false when model is not loaded', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(undefined);

      const result = await service.validateInput('test-model', { data: [1, 2, 3] });

      expect(result).toBe(false);
    });

    it('should return false when validation fails', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);
      mockModelValidator.validateInputData.mockResolvedValue({
        isValid: false,
        errors: ['Invalid input'],
        warnings: []
      });

      const result = await service.validateInput('test-model', { data: [1, 2, 3] });

      expect(result).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);
      mockModelValidator.validateInputData.mockRejectedValue(new Error('Validation error'));

      const result = await service.validateInput('test-model', { data: [1, 2, 3] });

      expect(result).toBe(false);
    });
  });

  describe('getModelInputSchema', () => {
    it('should return model input schema', async () => {
      const mockSchema = { type: 'object', properties: { data: { type: 'array' } } };
      const mockLoadedModel = {
        id: 'test-model',
        model: {},
        format: ModelFormat.PICKLE,
        inputSchema: mockSchema,
        loadedAt: new Date(),
        lastUsed: new Date()
      };

      mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);

      const result = await service.getModelInputSchema('test-model');

      expect(result).toEqual(mockSchema);
    });

    it('should return default schema when model has no schema', async () => {
      const mockLoadedModel = {
        id: 'test-model',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(),
        lastUsed: new Date()
      };

      mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);

      const result = await service.getModelInputSchema('test-model');

      expect(result).toEqual({
        type: 'object',
        properties: {
          data: {
            type: 'array',
            description: 'Input data for prediction'
          }
        },
        required: ['data']
      });
    });

    it('should throw error when model is not loaded', async () => {
      mockModelLoader.getLoadedModel.mockReturnValue(undefined);

      await expect(service.getModelInputSchema('test-model')).rejects.toThrow('is not loaded');
    });
  });

  describe('utility methods', () => {
    it('should return cache stats', () => {
      const mockStats = { size: 2, maxSize: 10, models: ['model1', 'model2'] };
      mockModelLoader.getCacheStats.mockReturnValue(mockStats);

      const result = service.getCacheStats();

      expect(result).toEqual(mockStats);
    });

    it('should preload model if not already loaded', async () => {
      const mockMetadata: ModelMetadata = {
        id: 'test-model',
        name: 'Test Model',
        description: 'A test model',
        userId: 'user-1',
        fileFormat: ModelFormat.PICKLE,
        filePath: '/path/to/model.pkl',
        endpointUrl: '/api/predict/test-model',
        createdAt: new Date(),
        lastUsed: new Date(),
        requestCount: 0,
        status: 'active' as any
      };

      mockModelLoader.isModelLoaded.mockReturnValue(false);
      mockModelValidator.validateModel.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockModelLoader.loadModel.mockResolvedValue({
        id: mockMetadata.id,
        model: {},
        format: mockMetadata.fileFormat,
        loadedAt: new Date(),
        lastUsed: new Date()
      });

      await service.preloadModel(mockMetadata);

      expect(mockModelLoader.loadModel).toHaveBeenCalledWith(mockMetadata);
    });

    it('should not preload model if already loaded', async () => {
      const mockMetadata: ModelMetadata = {
        id: 'test-model',
        name: 'Test Model',
        description: 'A test model',
        userId: 'user-1',
        fileFormat: ModelFormat.PICKLE,
        filePath: '/path/to/model.pkl',
        endpointUrl: '/api/predict/test-model',
        createdAt: new Date(),
        lastUsed: new Date(),
        requestCount: 0,
        status: 'active' as any
      };

      mockModelLoader.isModelLoaded.mockReturnValue(true);

      await service.preloadModel(mockMetadata);

      expect(mockModelLoader.loadModel).not.toHaveBeenCalled();
    });
  });

  describe('prediction execution by format', () => {
    const formats = [
      { format: ModelFormat.PICKLE, expectedType: 'python' },
      { format: ModelFormat.JOBLIB, expectedType: 'python' },
      { format: ModelFormat.KERAS, expectedType: 'keras' },
      { format: ModelFormat.ONNX, expectedType: 'onnx' },
      { format: ModelFormat.PYTORCH, expectedType: 'pytorch' },
      { format: ModelFormat.PYTORCH_STATE, expectedType: 'pytorch' }
    ];

    formats.forEach(({ format, expectedType }) => {
      it(`should execute ${format} prediction and return mock result`, async () => {
        const mockLoadedModel = {
          id: 'test-model',
          model: {},
          format,
          inputSchema: { type: 'object' },
          loadedAt: new Date(),
          lastUsed: new Date()
        };

        mockModelLoader.getLoadedModel.mockReturnValue(mockLoadedModel);
        mockModelValidator.validateInputData.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: []
        });

        const result = await service.predict({
          modelId: 'test-model',
          inputData: { data: [1, 2, 3] }
        });

        expect(result.status).toBe('success');
        expect(result.predictions).toBeDefined();
        expect(result.predictions.model_type).toBe(expectedType);
        expect(result.predictions.timestamp).toBeDefined();
      });
    });
  });
});