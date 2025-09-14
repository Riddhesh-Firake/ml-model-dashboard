import { ModelManagementService } from '../model-management.service';
import { ModelRepository } from '../../../database/repositories/model.repository';
import { UsageTrackingService } from '../usage-tracking.service';
import { DatabaseConnection } from '../../../database/connection';
import { ValidationError, NotFoundError } from '../../../models/error.model';
import { ModelMetadata, UpdateModelRequest, ModelFormat } from '../../../models/model.model';
import { ModelStatus } from '../../../models/constants';

// Mock the repository, usage tracking service and UUID
jest.mock('../../../database/repositories/model.repository');
jest.mock('../usage-tracking.service');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));

describe('ModelManagementService', () => {
  let service: ModelManagementService;
  let mockRepository: jest.Mocked<ModelRepository>;
  let mockUsageTrackingService: jest.Mocked<UsageTrackingService>;
  let mockDb: jest.Mocked<DatabaseConnection>;

  const mockModel: ModelMetadata = {
    id: 'model-123',
    name: 'Test Model',
    description: 'A test model',
    userId: 'user-123',
    fileFormat: ModelFormat.PICKLE,
    filePath: '/path/to/model.pkl',
    endpointUrl: '/api/predict/model-123',
    createdAt: new Date('2023-01-01'),
    lastUsed: new Date('2023-01-02'),
    requestCount: 5,
    status: ModelStatus.ACTIVE
  };

  beforeEach(() => {
    mockDb = {} as jest.Mocked<DatabaseConnection>;
    mockRepository = new ModelRepository(mockDb) as jest.Mocked<ModelRepository>;
    mockUsageTrackingService = new UsageTrackingService(mockDb) as jest.Mocked<UsageTrackingService>;
    service = new ModelManagementService(mockDb);
    (service as any).modelRepository = mockRepository;
    (service as any).usageTrackingService = mockUsageTrackingService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createModel', () => {
    it('should throw error as creation should be handled by upload service', async () => {
      const request = {
        name: 'Test Model',
        description: 'Test description',
        userId: 'user-123'
      };

      await expect(service.createModel(request)).rejects.toThrow(
        'Model creation should be handled through the upload service'
      );
    });
  });

  describe('getModel', () => {
    it('should return model when found', async () => {
      mockRepository.findById.mockResolvedValue(mockModel);

      const result = await service.getModel('model-123');

      expect(result).toEqual(mockModel);
      expect(mockRepository.findById).toHaveBeenCalledWith('model-123');
    });

    it('should return null when model not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getModel('nonexistent');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('nonexistent');
    });

    it('should throw ValidationError for empty model ID', async () => {
      await expect(service.getModel('')).rejects.toThrow('Model ID is required');
      await expect(service.getModel('   ')).rejects.toThrow('Model ID is required');
    });
  });

  describe('getUserModels', () => {
    it('should return user models', async () => {
      const models = [mockModel];
      mockRepository.findByUserId.mockResolvedValue(models);

      const result = await service.getUserModels('user-123');

      expect(result).toEqual(models);
      expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should return empty array when user has no models', async () => {
      mockRepository.findByUserId.mockResolvedValue([]);

      const result = await service.getUserModels('user-123');

      expect(result).toEqual([]);
    });

    it('should throw ValidationError for empty user ID', async () => {
      await expect(service.getUserModels('')).rejects.toThrow('User ID is required');
    });
  });

  describe('updateModel', () => {
    const updateRequest: UpdateModelRequest = {
      name: 'Updated Model',
      description: 'Updated description'
    };

    it('should update model successfully', async () => {
      const updatedModel = { ...mockModel, ...updateRequest };
      mockRepository.findById.mockResolvedValue(mockModel);
      mockRepository.update.mockResolvedValue(updatedModel);

      const result = await service.updateModel('model-123', updateRequest);

      expect(result).toEqual(updatedModel);
      expect(mockRepository.findById).toHaveBeenCalledWith('model-123');
      expect(mockRepository.update).toHaveBeenCalledWith('model-123', updateRequest);
    });

    it('should throw NotFoundError when model does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateModel('nonexistent', updateRequest))
        .rejects.toThrow('Model with ID nonexistent not found');
    });

    it('should throw ValidationError for empty model ID', async () => {
      await expect(service.updateModel('', updateRequest))
        .rejects.toThrow('Model ID is required');
    });

    it('should throw ValidationError for empty name', async () => {
      mockRepository.findById.mockResolvedValue(mockModel);

      await expect(service.updateModel('model-123', { name: '' }))
        .rejects.toThrow('Model name cannot be empty');
    });
  });

  describe('deleteModel', () => {
    it('should soft delete model successfully', async () => {
      mockRepository.findById.mockResolvedValue(mockModel);
      mockRepository.update.mockResolvedValue({ ...mockModel, status: 'deleted' as any });

      await service.deleteModel('model-123');

      expect(mockRepository.findById).toHaveBeenCalledWith('model-123');
      expect(mockRepository.update).toHaveBeenCalledWith('model-123', { status: ModelStatus.DELETED });
    });

    it('should throw NotFoundError when model does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deleteModel('nonexistent'))
        .rejects.toThrow('Model with ID nonexistent not found');
    });

    it('should throw ValidationError for empty model ID', async () => {
      await expect(service.deleteModel('')).rejects.toThrow('Model ID is required');
    });
  });

  describe('incrementRequestCount', () => {
    it('should increment request count successfully', async () => {
      mockRepository.incrementRequestCount.mockResolvedValue();

      await service.incrementRequestCount('model-123');

      expect(mockRepository.incrementRequestCount).toHaveBeenCalledWith('model-123');
    });

    it('should throw ValidationError for empty model ID', async () => {
      await expect(service.incrementRequestCount('')).rejects.toThrow('Model ID is required');
    });
  });

  describe('updateLastUsed', () => {
    it('should update last used timestamp successfully', async () => {
      const updatedModel = { ...mockModel, lastUsed: new Date() };
      mockRepository.update.mockResolvedValue(updatedModel);

      await service.updateLastUsed('model-123');

      expect(mockRepository.update).toHaveBeenCalledWith('model-123', 
        expect.objectContaining({ lastUsed: expect.any(Date) }));
    });

    it('should throw ValidationError for empty model ID', async () => {
      await expect(service.updateLastUsed('')).rejects.toThrow('Model ID is required');
    });
  });

  describe('getModelUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockFullUsageStats = {
        totalRequests: mockModel.requestCount,
        successfulRequests: 4,
        failedRequests: 1,
        lastUsed: mockModel.lastUsed,
        averageResponseTime: 150,
        requestsToday: 2,
        requestsThisWeek: 3,
        requestsThisMonth: 5
      };

      const expectedResult = {
        totalRequests: mockModel.requestCount,
        lastUsed: mockModel.lastUsed,
        averageResponseTime: 150
      };
      
      mockRepository.findById.mockResolvedValue(mockModel);
      mockUsageTrackingService.getModelUsageStats.mockResolvedValue(mockFullUsageStats);

      const result = await service.getModelUsageStats('model-123');

      expect(result).toEqual(expectedResult);
      expect(mockRepository.findById).toHaveBeenCalledWith('model-123');
      expect(mockUsageTrackingService.getModelUsageStats).toHaveBeenCalledWith('model-123');
    });

    it('should throw NotFoundError when model does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getModelUsageStats('nonexistent'))
        .rejects.toThrow('Model with ID nonexistent not found');
    });

    it('should throw ValidationError for empty model ID', async () => {
      await expect(service.getModelUsageStats('')).rejects.toThrow('Model ID is required');
    });
  });
});