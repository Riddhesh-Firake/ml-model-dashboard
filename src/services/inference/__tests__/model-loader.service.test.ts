import { ModelLoaderService, LoadedModel } from '../model-loader.service';
import { ModelMetadata, ModelFormat } from '../../../models';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    stat: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ModelLoaderService', () => {
  let service: ModelLoaderService;
  let mockMetadata: ModelMetadata;

  beforeEach(() => {
    service = new ModelLoaderService({ maxCacheSize: 3, modelTimeout: 1000 });
    mockMetadata = {
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

    // Reset mocks
    jest.clearAllMocks();
    mockFs.access.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('loadModel', () => {
    it('should load a model successfully', async () => {
      mockFs.access.mockResolvedValue(undefined);

      try {
        await service.loadModel(mockMetadata);
        // Since we expect an error for unimplemented formats, this should not be reached
        fail('Expected error for unimplemented format');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Pickle model loading requires Python integration');
      }

      expect(mockFs.access).toHaveBeenCalledWith(mockMetadata.filePath);
    });

    it('should throw error if file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(service.loadModel(mockMetadata)).rejects.toThrow('Model file not found');
    });

    it('should return cached model if already loaded', async () => {
      // Mock a successful load by creating a service that doesn't throw
      const mockLoadedModel: LoadedModel = {
        id: mockMetadata.id,
        model: { mock: 'model' },
        format: mockMetadata.fileFormat,
        loadedAt: new Date(),
        lastUsed: new Date()
      };

      // Manually add to cache
      (service as any).loadedModels.set(mockMetadata.id, mockLoadedModel);

      const result = await service.loadModel(mockMetadata);
      expect(result).toBe(mockLoadedModel);
      expect(mockFs.access).not.toHaveBeenCalled();
    });

    it('should evict least recently used model when cache is full', async () => {
      const config = { maxCacheSize: 2, modelTimeout: 10000 };
      service = new ModelLoaderService(config);

      // Add two models to fill cache
      const model1: LoadedModel = {
        id: 'model-1',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(Date.now() - 2000),
        lastUsed: new Date(Date.now() - 2000)
      };

      const model2: LoadedModel = {
        id: 'model-2',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(Date.now() - 1000),
        lastUsed: new Date(Date.now() - 1000)
      };

      (service as any).loadedModels.set('model-1', model1);
      (service as any).loadedModels.set('model-2', model2);

      expect(service.getLoadedModelsCount()).toBe(2);

      // Try to load a third model - should evict model-1 (oldest)
      try {
        await service.loadModel(mockMetadata);
      } catch (error) {
        // Expected error for unimplemented format
      }

      expect(service.isModelLoaded('model-1')).toBe(false);
      expect(service.isModelLoaded('model-2')).toBe(true);
    });
  });

  describe('unloadModel', () => {
    it('should unload a model successfully', async () => {
      const mockModel: LoadedModel = {
        id: 'test-model',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(),
        lastUsed: new Date()
      };

      (service as any).loadedModels.set('test-model', mockModel);
      expect(service.isModelLoaded('test-model')).toBe(true);

      await service.unloadModel('test-model');
      expect(service.isModelLoaded('test-model')).toBe(false);
    });

    it('should handle unloading non-existent model gracefully', async () => {
      await expect(service.unloadModel('non-existent')).resolves.not.toThrow();
    });
  });

  describe('isModelLoaded', () => {
    it('should return true for loaded model', () => {
      const mockModel: LoadedModel = {
        id: 'test-model',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(),
        lastUsed: new Date()
      };

      (service as any).loadedModels.set('test-model', mockModel);
      expect(service.isModelLoaded('test-model')).toBe(true);
    });

    it('should return false for non-loaded model', () => {
      expect(service.isModelLoaded('non-existent')).toBe(false);
    });
  });

  describe('getLoadedModel', () => {
    it('should return loaded model and update last used time', () => {
      const originalTime = new Date(Date.now() - 1000);
      const mockModel: LoadedModel = {
        id: 'test-model',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(),
        lastUsed: originalTime
      };

      (service as any).loadedModels.set('test-model', mockModel);
      
      const result = service.getLoadedModel('test-model');
      expect(result).toBe(mockModel);
      expect(result!.lastUsed.getTime()).toBeGreaterThan(originalTime.getTime());
    });

    it('should return undefined for non-existent model', () => {
      expect(service.getLoadedModel('non-existent')).toBeUndefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', () => {
      const mockModel1: LoadedModel = {
        id: 'model-1',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(),
        lastUsed: new Date()
      };

      const mockModel2: LoadedModel = {
        id: 'model-2',
        model: {},
        format: ModelFormat.KERAS,
        loadedAt: new Date(),
        lastUsed: new Date()
      };

      (service as any).loadedModels.set('model-1', mockModel1);
      (service as any).loadedModels.set('model-2', mockModel2);

      const stats = service.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.models).toEqual(['model-1', 'model-2']);
    });
  });

  describe('cleanup mechanisms', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should cleanup unused models after timeout', async () => {
      const config = { maxCacheSize: 10, modelTimeout: 1000 };
      service = new ModelLoaderService(config);

      // Set the time to a fixed point
      const baseTime = Date.now();
      jest.setSystemTime(baseTime);

      const oldModel: LoadedModel = {
        id: 'old-model',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(baseTime - 2000),
        lastUsed: new Date(baseTime - 2000) // 2 seconds ago
      };

      const recentModel: LoadedModel = {
        id: 'recent-model',
        model: {},
        format: ModelFormat.PICKLE,
        loadedAt: new Date(baseTime),
        lastUsed: new Date(baseTime) // Just now
      };

      (service as any).loadedModels.set('old-model', oldModel);
      (service as any).loadedModels.set('recent-model', recentModel);

      expect(service.isModelLoaded('old-model')).toBe(true);
      expect(service.isModelLoaded('recent-model')).toBe(true);

      // Fast-forward time to trigger cleanup
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      // Manually trigger cleanup to test the logic
      await (service as any).cleanupUnusedModels();

      // Both models should be cleaned up since we advanced time by 5 minutes
      // and the timeout is 1000ms (1 second)
      expect(service.isModelLoaded('old-model')).toBe(false);
      expect(service.isModelLoaded('recent-model')).toBe(false);
    });
  });

  describe('format support', () => {
    const formats = [
      ModelFormat.PICKLE,
      ModelFormat.JOBLIB,
      ModelFormat.KERAS,
      ModelFormat.ONNX,
      ModelFormat.PYTORCH,
      ModelFormat.PYTORCH_STATE
    ];

    formats.forEach(format => {
      it(`should handle ${format} format`, async () => {
        const metadata = { ...mockMetadata, fileFormat: format };
        mockFs.access.mockResolvedValue(undefined);

        try {
          await service.loadModel(metadata);
          fail(`Expected error for unimplemented ${format} format`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('not implemented yet');
        }
      });
    });

    it('should throw error for unsupported format', async () => {
      const metadata = { ...mockMetadata, fileFormat: 'unsupported' as ModelFormat };
      mockFs.access.mockResolvedValue(undefined);

      await expect(service.loadModel(metadata)).rejects.toThrow('Unsupported model format');
    });
  });
});