import {
  User,
  ModelMetadata,
  StoredModel,
  EndpointConfig,
  ModelFormat,
  ModelStatus,
  SubscriptionType
} from '../index';
import {
  userSchema,
  modelMetadataSchema,
  storedModelSchema,
  endpointConfigSchema,
  createUserSchema,
  createModelSchema
} from '../validation.schemas';
import { validateSchema } from '../validation.utils';

describe('Data Models and Validation', () => {
  describe('User Model', () => {
    it('should validate a valid user object', () => {
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        apiKey: 'abcd1234efgh5678ijkl9012mnop3456',
        createdAt: new Date(),
        subscription: SubscriptionType.FREE,
        rateLimits: {
          requestsPerMinute: 10,
          modelsLimit: 5
        }
      };

      expect(() => validateSchema(user, userSchema)).not.toThrow();
    });

    it('should validate create user request', () => {
      const createRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      expect(() => validateSchema(createRequest, createUserSchema)).not.toThrow();
    });
  });

  describe('Model Metadata', () => {
    it('should validate a valid model metadata object', () => {
      const modelMetadata: ModelMetadata = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Model',
        description: 'A test machine learning model',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        fileFormat: ModelFormat.PICKLE,
        filePath: '/models/test-model.pkl',
        endpointUrl: 'https://api.example.com/predict/123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        lastUsed: new Date(),
        requestCount: 0,
        status: ModelStatus.ACTIVE
      };

      expect(() => validateSchema(modelMetadata, modelMetadataSchema)).not.toThrow();
    });

    it('should validate create model request', () => {
      const createRequest = {
        name: 'Test Model',
        description: 'A test model',
        userId: '123e4567-e89b-12d3-a456-426614174000'
      };

      expect(() => validateSchema(createRequest, createModelSchema)).not.toThrow();
    });
  });

  describe('Stored Model', () => {
    it('should validate a valid stored model object', () => {
      const storedModel: StoredModel = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalName: 'my-model.pkl',
        storagePath: '/storage/models/123e4567-e89b-12d3-a456-426614174000.pkl',
        fileSize: 1024000,
        checksum: 'sha256:abcd1234efgh5678',
        encryptionKey: 'encryption-key-123',
        format: ModelFormat.PICKLE
      };

      expect(() => validateSchema(storedModel, storedModelSchema)).not.toThrow();
    });
  });

  describe('Endpoint Config', () => {
    it('should validate a valid endpoint config object', () => {
      const endpointConfig: EndpointConfig = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        modelId: '123e4567-e89b-12d3-a456-426614174001',
        url: 'https://api.example.com/predict/123e4567-e89b-12d3-a456-426614174001',
        inputSchema: {
          type: 'object',
          properties: {
            features: { type: 'array' }
          },
          required: ['features']
        },
        outputSchema: {
          type: 'object',
          properties: {
            prediction: { type: 'number' }
          },
          required: ['prediction']
        },
        rateLimits: {
          requestsPerMinute: 10,
          requestsPerHour: 100,
          requestsPerDay: 1000
        },
        authRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => validateSchema(endpointConfig, endpointConfigSchema)).not.toThrow();
    });
  });

  describe('Enums', () => {
    it('should have correct ModelFormat values', () => {
      expect(ModelFormat.PICKLE).toBe('pkl');
      expect(ModelFormat.JOBLIB).toBe('joblib');
      expect(ModelFormat.KERAS).toBe('h5');
      expect(ModelFormat.ONNX).toBe('onnx');
      expect(ModelFormat.PYTORCH).toBe('pt');
      expect(ModelFormat.PYTORCH_STATE).toBe('pth');
    });

    it('should have correct ModelStatus values', () => {
      expect(ModelStatus.ACTIVE).toBe('active');
      expect(ModelStatus.INACTIVE).toBe('inactive');
      expect(ModelStatus.ARCHIVED).toBe('archived');
    });

    it('should have correct SubscriptionType values', () => {
      expect(SubscriptionType.FREE).toBe('free');
      expect(SubscriptionType.PREMIUM).toBe('premium');
    });
  });
});