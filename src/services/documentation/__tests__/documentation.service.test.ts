import { DocumentationService } from '../documentation.service';
import { InferenceService } from '../../inference';
import { ModelMetadata, ModelFormat } from '../../../models/model.model';
import { ModelStatus } from '../../../models/constants';

// Mock the InferenceService
jest.mock('../../inference');

describe('DocumentationService', () => {
  let documentationService: DocumentationService;
  let mockInferenceService: jest.Mocked<InferenceService>;

  const mockModel: ModelMetadata = {
    id: 'test-model-id',
    name: 'Test Model',
    description: 'A test machine learning model',
    userId: 'test-user-id',
    fileFormat: ModelFormat.PICKLE,
    filePath: '/path/to/model.pkl',
    endpointUrl: 'http://localhost:3000/api/predict/test-model-id',
    createdAt: new Date('2024-01-01'),
    lastUsed: new Date('2024-01-02'),
    requestCount: 10,
    status: ModelStatus.ACTIVE
  };

  beforeEach(() => {
    mockInferenceService = new InferenceService() as jest.Mocked<InferenceService>;
    documentationService = new DocumentationService(mockInferenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateModelDocumentation', () => {
    it('should generate comprehensive documentation for a model', async () => {
      // Mock inference service methods
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.getModelInputSchema.mockResolvedValue({
        type: 'object',
        properties: {
          feature1: { type: 'number' },
          feature2: { type: 'string' }
        },
        required: ['feature1', 'feature2']
      });
      mockInferenceService.predict.mockResolvedValue({
        status: 'success',
        predictions: ['positive'],
        confidence: 0.95,
        processingTime: 45
      });

      const documentation = await documentationService.generateModelDocumentation(mockModel);

      expect(documentation).toEqual({
        modelId: mockModel.id,
        name: mockModel.name,
        description: mockModel.description,
        endpointUrl: mockModel.endpointUrl,
        inputSchema: expect.any(Object),
        outputSchema: expect.any(Object),
        examples: expect.any(Array),
        usage: expect.objectContaining({
          curl: expect.any(String),
          javascript: expect.any(String),
          python: expect.any(String)
        })
      });

      expect(mockInferenceService.getModelInputSchema).toHaveBeenCalledWith(mockModel.id);
      expect(documentation.examples).toHaveLength(1);
      expect(documentation.usage.curl).toContain(mockModel.endpointUrl);
    });

    it('should handle model loading if not already loaded', async () => {
      mockInferenceService.isModelLoaded.mockReturnValue(false);
      mockInferenceService.loadModel.mockResolvedValue(undefined);
      mockInferenceService.getModelInputSchema.mockResolvedValue({
        type: 'object',
        properties: {}
      });

      await documentationService.generateModelDocumentation(mockModel);

      expect(mockInferenceService.loadModel).toHaveBeenCalledWith(mockModel);
    });

    it('should generate mock examples when prediction fails', async () => {
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.getModelInputSchema.mockResolvedValue({
        type: 'object',
        properties: {
          feature1: { type: 'number' }
        }
      });
      mockInferenceService.predict.mockRejectedValue(new Error('Prediction failed'));

      const documentation = await documentationService.generateModelDocumentation(mockModel);

      expect(documentation.examples).toHaveLength(1);
      expect(documentation.examples[0]?.response.predictions).toEqual(['positive']);
    });

    it('should handle different model formats', async () => {
      const h5Model = { ...mockModel, fileFormat: ModelFormat.KERAS };
      
      mockInferenceService.isModelLoaded.mockReturnValue(true);
      mockInferenceService.getModelInputSchema.mockResolvedValue({
        type: 'object',
        properties: {}
      });

      const documentation = await documentationService.generateModelDocumentation(h5Model);

      expect(documentation.outputSchema.properties.predictions.type).toBe('array');
    });

    it('should throw error when documentation generation fails', async () => {
      mockInferenceService.isModelLoaded.mockReturnValue(false);
      mockInferenceService.loadModel.mockRejectedValue(new Error('Model loading failed'));

      await expect(documentationService.generateModelDocumentation(mockModel))
        .rejects.toThrow('Failed to generate documentation');
    });
  });

  describe('generateModelOpenAPISpec', () => {
    it('should generate valid OpenAPI specification', async () => {
      const mockDocumentation = {
        modelId: mockModel.id,
        name: mockModel.name,
        description: mockModel.description,
        endpointUrl: mockModel.endpointUrl,
        inputSchema: {
          type: 'object',
          properties: {
            feature1: { type: 'number' }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            predictions: { type: 'array' }
          }
        },
        examples: [{
          request: { feature1: 1.5 },
          response: { predictions: ['positive'] }
        }],
        usage: {
          curl: 'curl example',
          javascript: 'js example',
          python: 'python example'
        }
      };

      const openApiSpec = documentationService.generateModelOpenAPISpec(mockModel, mockDocumentation);

      expect(openApiSpec).toHaveProperty('openapi', '3.0.0');
      expect(openApiSpec).toHaveProperty('info');
      expect(openApiSpec.info.title).toBe(`${mockModel.name} API`);
      expect(openApiSpec).toHaveProperty('paths');
      expect(openApiSpec.paths).toHaveProperty(`/api/predict/${mockModel.id}`);
      expect(openApiSpec).toHaveProperty('components.securitySchemes');
    });
  });
});