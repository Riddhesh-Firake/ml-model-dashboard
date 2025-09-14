import { TestingInterfaceService } from '../testing-interface.service';
import { DocumentationService } from '../documentation.service';
import { InferenceService } from '../../inference';
import { ModelMetadata, ModelFormat } from '../../../models/model.model';
import { ModelStatus } from '../../../models/constants';

// Mock the services
jest.mock('../documentation.service');
jest.mock('../../inference');

describe('TestingInterfaceService', () => {
  let testingInterfaceService: TestingInterfaceService;
  let mockDocumentationService: jest.Mocked<DocumentationService>;
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
    mockDocumentationService = new DocumentationService({} as any) as jest.Mocked<DocumentationService>;
    mockInferenceService = new InferenceService() as jest.Mocked<InferenceService>;
    testingInterfaceService = new TestingInterfaceService(mockDocumentationService, mockInferenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTestingInterface', () => {
    it('should generate testing interface configuration', async () => {
      const mockDocumentation = {
        modelId: mockModel.id,
        name: mockModel.name,
        description: mockModel.description,
        endpointUrl: mockModel.endpointUrl,
        inputSchema: {
          type: 'object',
          properties: {
            feature1: { type: 'number' },
            feature2: { type: 'string' }
          }
        },
        outputSchema: {},
        examples: [
          { request: { feature1: 1.5, feature2: 'test' }, response: {} },
          { request: { feature1: 2.0, feature2: 'example' }, response: {} }
        ],
        usage: { curl: '', javascript: '', python: '' }
      };

      mockDocumentationService.generateModelDocumentation.mockResolvedValue(mockDocumentation);

      const testingInterface = await testingInterfaceService.generateTestingInterface(mockModel);

      expect(testingInterface).toEqual({
        modelId: mockModel.id,
        name: mockModel.name,
        description: mockModel.description,
        inputSchema: mockDocumentation.inputSchema,
        examples: [
          { feature1: 1.5, feature2: 'test' },
          { feature1: 2.0, feature2: 'example' }
        ],
        endpointUrl: mockModel.endpointUrl
      });

      expect(mockDocumentationService.generateModelDocumentation).toHaveBeenCalledWith(mockModel);
    });

    it('should throw error when documentation generation fails', async () => {
      mockDocumentationService.generateModelDocumentation.mockRejectedValue(new Error('Documentation failed'));

      await expect(testingInterfaceService.generateTestingInterface(mockModel))
        .rejects.toThrow('Failed to generate testing interface');
    });
  });

  describe('generateTestingInterfaceHTML', () => {
    it('should generate valid HTML for testing interface', () => {
      const config = {
        modelId: mockModel.id,
        name: mockModel.name,
        description: mockModel.description,
        inputSchema: {
          type: 'object',
          properties: {
            feature1: { type: 'number' }
          }
        },
        examples: [{ feature1: 1.5 }],
        endpointUrl: mockModel.endpointUrl
      };

      const html = testingInterfaceService.generateTestingInterfaceHTML(config);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(mockModel.name);
      expect(html).toContain(mockModel.description);
      expect(html).toContain(mockModel.endpointUrl);
      expect(html).toContain('Test Model');
      expect(html).toContain('JavaScript');
      expect(html).toContain('Python');
      expect(html).toContain('cURL');
    });

    it('should include user token when provided', () => {
      const config = {
        modelId: mockModel.id,
        name: mockModel.name,
        description: mockModel.description,
        inputSchema: {},
        examples: [],
        endpointUrl: mockModel.endpointUrl
      };

      const userToken = 'Bearer test-token';
      const html = testingInterfaceService.generateTestingInterfaceHTML(config, userToken);

      expect(html).toContain(userToken);
    });
  });

  describe('validateInputAgainstSchema', () => {
    it('should validate input data against schema successfully', () => {
      const schema = {
        type: 'object',
        properties: {
          feature1: { type: 'number' },
          feature2: { type: 'string' }
        },
        required: ['feature1']
      };

      const validInput = { feature1: 1.5, feature2: 'test' };
      const result = testingInterfaceService.validateInputAgainstSchema(validInput, schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          feature1: { type: 'number' },
          feature2: { type: 'string' }
        },
        required: ['feature1', 'feature2']
      };

      const invalidInput = { feature1: 1.5 };
      const result = testingInterfaceService.validateInputAgainstSchema(invalidInput, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: feature2');
    });

    it('should detect type mismatches', () => {
      const schema = {
        type: 'object',
        properties: {
          feature1: { type: 'number' },
          feature2: { type: 'string' }
        }
      };

      const invalidInput = { feature1: 'not-a-number', feature2: 123 };
      const result = testingInterfaceService.validateInputAgainstSchema(invalidInput, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'feature1' must be a number");
      expect(result.errors).toContain("Field 'feature2' must be a string");
    });

    it('should validate enum values', () => {
      const schema = {
        type: 'object',
        properties: {
          category: { 
            type: 'string',
            enum: ['A', 'B', 'C']
          }
        }
      };

      const invalidInput = { category: 'D' };
      const result = testingInterfaceService.validateInputAgainstSchema(invalidInput, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'category' must be one of: A, B, C");
    });

    it('should validate number ranges', () => {
      const schema = {
        type: 'object',
        properties: {
          score: { 
            type: 'number',
            minimum: 0,
            maximum: 100
          }
        }
      };

      const invalidInput = { score: 150 };
      const result = testingInterfaceService.validateInputAgainstSchema(invalidInput, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'score' must be <= 100");
    });

    it('should return valid for empty schema', () => {
      const result = testingInterfaceService.validateInputAgainstSchema({ any: 'data' }, null);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});