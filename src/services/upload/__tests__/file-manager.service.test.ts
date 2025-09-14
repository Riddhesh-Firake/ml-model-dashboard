import { fileManagerService, FileManagerService } from '../file-manager.service';
import { storageService } from '../storage.service';
import { validationService } from '../validation.service';
import { tempFileManager } from '../temp-file.manager';
import { StoredModelRepository } from '../../../database/repositories/stored-model.repository';
import { ModelRepository } from '../../../database/repositories/model.repository';
import { AppError } from '../../../models/error.model';
import { ErrorCode, HttpStatus } from '../../../models/constants';
import { ModelFormat } from '../../../models/model.model';

// Mock dependencies
jest.mock('../storage.service');
jest.mock('../validation.service');
jest.mock('../temp-file.manager');
jest.mock('../../../database/repositories/stored-model.repository');
jest.mock('../../../database/repositories/model.repository');
jest.mock('../../../database/database.manager');

const mockStorageService = storageService as jest.Mocked<typeof storageService>;
const mockValidationService = validationService as jest.Mocked<typeof validationService>;
const mockTempFileManager = tempFileManager as jest.Mocked<typeof tempFileManager>;

describe('FileManagerService', () => {
  let service: FileManagerService;
  let mockStoredModelRepository: jest.Mocked<StoredModelRepository>;
  let mockModelRepository: jest.Mocked<ModelRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock repository methods
    mockStoredModelRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockModelRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Create service instance with mocked dependencies
    service = new FileManagerService();
    (service as any).storedModelRepository = mockStoredModelRepository;
    (service as any).modelRepository = mockModelRepository;
  });

  describe('processUploadedFile', () => {
    const mockTempFilePath = '/tmp/test-file.pkl';
    const mockOriginalName = 'model.pkl';
    const mockOptions = {
      userId: 'user-123',
      modelName: 'Test Model',
      description: 'Test description'
    };

    it('should successfully process a valid file', async () => {
      // Mock validation result
      const mockValidationResult = {
        isValid: true,
        isSafe: true,
        overallRisk: 'low' as const,
        recommendations: [],
        fileValidation: {
          isValid: true,
          format: 'pickle',
          errors: []
        },
        securityScan: {
          isSafe: true,
          threats: []
        }
      };

      // Mock storage result
      const mockStorageResult = {
        fileId: 'file-123',
        storagePath: '/storage/models/file-123.pkl',
        encryptionKey: 'encryption-key',
        checksum: 'checksum-123',
        size: 1024,
        originalName: mockOriginalName
      };

      // Mock database records
      const mockStoredModel = {
        id: 'stored-123',
        modelId: 'model-123',
        originalName: mockOriginalName,
        storagePath: mockStorageResult.storagePath,
        fileSize: mockStorageResult.size,
        checksum: mockStorageResult.checksum,
        encryptionKey: mockStorageResult.encryptionKey,
        format: ModelFormat.PICKLE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockModelMetadata = {
        id: 'model-123',
        name: mockOptions.modelName,
        description: mockOptions.description,
        userId: mockOptions.userId,
        fileFormat: ModelFormat.PICKLE,
        filePath: mockStorageResult.storagePath,
        endpointUrl: 'http://localhost:3000/api/predict/model-123',
        createdAt: new Date(),
        lastUsed: new Date(),
        requestCount: 0,
        status: 'active' as const
      };

      // Setup mocks
      mockValidationService.validateUploadedFile.mockResolvedValue(mockValidationResult);
      mockStorageService.storeFile.mockResolvedValue(mockStorageResult);
      mockStoredModelRepository.create.mockResolvedValue(mockStoredModel);
      mockModelRepository.create.mockResolvedValue(mockModelMetadata);

      // Execute
      const result = await service.processUploadedFile(mockTempFilePath, mockOriginalName, mockOptions);

      // Verify
      expect(mockValidationService.validateUploadedFile).toHaveBeenCalledWith(mockTempFilePath);
      expect(mockStorageService.storeFile).toHaveBeenCalledWith(
        mockTempFilePath,
        mockOriginalName,
        expect.any(Object)
      );
      expect(mockStoredModelRepository.create).toHaveBeenCalled();
      expect(mockModelRepository.create).toHaveBeenCalled();
      expect(result.storedModel).toEqual(mockStoredModel);
      expect(result.modelMetadata).toEqual(mockModelMetadata);
      expect(result.validationResult).toEqual(mockValidationResult);
      expect(result.storageResult).toEqual(mockStorageResult);
    });

    it('should throw error when file validation fails', async () => {
      const mockValidationResult = {
        isValid: false,
        isSafe: true,
        overallRisk: 'medium' as const,
        recommendations: ['Use supported format'],
        fileValidation: {
          isValid: false,
          format: 'unknown',
          errors: ['Invalid file format']
        },
        securityScan: {
          isSafe: true,
          threats: []
        }
      };

      mockValidationService.validateUploadedFile.mockResolvedValue(mockValidationResult);

      await expect(
        service.processUploadedFile(mockTempFilePath, mockOriginalName, mockOptions)
      ).rejects.toThrow(AppError);

      expect(mockTempFileManager.cleanupFile).toHaveBeenCalledWith(mockTempFilePath);
    });

    it('should throw error when security scan fails', async () => {
      const mockValidationResult = {
        isValid: true,
        isSafe: false,
        overallRisk: 'high' as const,
        recommendations: ['Scan file for malware'],
        fileValidation: {
          isValid: true,
          format: 'pickle',
          errors: []
        },
        securityScan: {
          isSafe: false,
          threats: ['Malicious code detected']
        }
      };

      mockValidationService.validateUploadedFile.mockResolvedValue(mockValidationResult);

      await expect(
        service.processUploadedFile(mockTempFilePath, mockOriginalName, mockOptions)
      ).rejects.toThrow(AppError);

      expect(mockTempFileManager.cleanupFile).toHaveBeenCalledWith(mockTempFilePath);
    });

    it('should cleanup temp file on storage error', async () => {
      const mockValidationResult = {
        isValid: true,
        isSafe: true,
        overallRisk: 'low' as const,
        recommendations: [],
        fileValidation: {
          isValid: true,
          format: 'pickle',
          errors: []
        },
        securityScan: {
          isSafe: true,
          threats: []
        }
      };

      mockValidationService.validateUploadedFile.mockResolvedValue(mockValidationResult);
      mockStorageService.storeFile.mockRejectedValue(new Error('Storage failed'));

      await expect(
        service.processUploadedFile(mockTempFilePath, mockOriginalName, mockOptions)
      ).rejects.toThrow(AppError);

      expect(mockTempFileManager.cleanupFile).toHaveBeenCalledWith(mockTempFilePath);
    });
  });

  describe('retrieveFile', () => {
    it('should successfully retrieve a file', async () => {
      const mockModelId = 'model-123';
      const mockStoredModel = {
        id: 'stored-123',
        modelId: mockModelId,
        storagePath: '/storage/models/file-123.pkl',
        encryptionKey: 'encryption-key'
      };
      const mockBuffer = Buffer.from('file content');

      mockStoredModelRepository.findById.mockResolvedValue(mockStoredModel as any);
      mockStorageService.retrieveFile.mockResolvedValue(mockBuffer);

      const result = await service.retrieveFile(mockModelId);

      expect(mockStoredModelRepository.findById).toHaveBeenCalledWith(mockModelId);
      expect(mockStorageService.retrieveFile).toHaveBeenCalledWith(
        mockStoredModel.storagePath,
        mockStoredModel.encryptionKey
      );
      expect(result.buffer).toEqual(mockBuffer);
      expect(result.model).toEqual(mockStoredModel);
    });

    it('should throw error when model not found', async () => {
      const mockModelId = 'nonexistent-model';
      mockStoredModelRepository.findById.mockResolvedValue(null);

      await expect(service.retrieveFile(mockModelId)).rejects.toThrow(
        new AppError('Model not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
      );
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete a file', async () => {
      const mockModelId = 'model-123';
      const mockStoredModel = {
        id: 'stored-123',
        modelId: mockModelId,
        storagePath: '/storage/models/file-123.pkl'
      };

      mockStoredModelRepository.findById.mockResolvedValue(mockStoredModel as any);
      mockStorageService.deleteFile.mockResolvedValue();
      mockStoredModelRepository.delete.mockResolvedValue();

      await service.deleteFile(mockModelId);

      expect(mockStoredModelRepository.findById).toHaveBeenCalledWith(mockModelId);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockStoredModel.storagePath);
      expect(mockStoredModelRepository.delete).toHaveBeenCalledWith(mockModelId);
    });

    it('should throw error when model not found', async () => {
      const mockModelId = 'nonexistent-model';
      mockStoredModelRepository.findById.mockResolvedValue(null);

      await expect(service.deleteFile(mockModelId)).rejects.toThrow(
        new AppError('Model not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
      );
    });
  });

  describe('verifyFileIntegrity', () => {
    it('should return true for valid file integrity', async () => {
      const mockModelId = 'model-123';
      const mockStoredModel = {
        id: 'stored-123',
        modelId: mockModelId,
        storagePath: '/storage/models/file-123.pkl',
        checksum: 'valid-checksum'
      };

      mockStoredModelRepository.findById.mockResolvedValue(mockStoredModel as any);
      mockStorageService.verifyFileIntegrity.mockResolvedValue(true);

      const result = await service.verifyFileIntegrity(mockModelId);

      expect(result).toBe(true);
      expect(mockStorageService.verifyFileIntegrity).toHaveBeenCalledWith(
        mockStoredModel.storagePath,
        mockStoredModel.checksum
      );
    });

    it('should return false when model not found', async () => {
      const mockModelId = 'nonexistent-model';
      mockStoredModelRepository.findById.mockResolvedValue(null);

      const result = await service.verifyFileIntegrity(mockModelId);

      expect(result).toBe(false);
    });
  });

  describe('listUserFiles', () => {
    it('should return list of user files', async () => {
      const mockUserId = 'user-123';
      const mockFiles = [
        { id: 'file-1', userId: mockUserId },
        { id: 'file-2', userId: mockUserId }
      ];

      mockStoredModelRepository.findAll.mockResolvedValue(mockFiles as any);

      const result = await service.listUserFiles(mockUserId);

      expect(mockStoredModelRepository.findAll).toHaveBeenCalledWith({ userId: mockUserId });
      expect(result).toEqual(mockFiles);
    });
  });

  describe('updateFileMetadata', () => {
    it('should successfully update file metadata', async () => {
      const mockModelId = 'model-123';
      const mockUpdates = { originalName: 'new-name.pkl' };
      const mockUpdatedModel = {
        id: 'stored-123',
        modelId: mockModelId,
        originalName: 'new-name.pkl'
      };

      mockStoredModelRepository.update.mockResolvedValue(mockUpdatedModel as any);

      const result = await service.updateFileMetadata(mockModelId, mockUpdates);

      expect(mockStoredModelRepository.update).toHaveBeenCalledWith(mockModelId, mockUpdates);
      expect(result).toEqual(mockUpdatedModel);
    });

    it('should throw error when model not found for update', async () => {
      const mockModelId = 'nonexistent-model';
      const mockUpdates = { originalName: 'new-name.pkl' };

      mockStoredModelRepository.update.mockResolvedValue(null);

      await expect(service.updateFileMetadata(mockModelId, mockUpdates)).rejects.toThrow(
        new AppError('Model not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
      );
    });
  });

  describe('getStorageStatistics', () => {
    it('should return storage statistics', async () => {
      const mockStats = {
        totalFiles: 10,
        totalSize: 1024000,
        availableSpace: 5000000
      };

      mockStorageService.getStorageStats.mockResolvedValue(mockStats);

      const result = await service.getStorageStatistics();

      expect(mockStorageService.getStorageStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });
});