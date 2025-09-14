import { Request, Response, NextFunction } from 'express';
import { UploadService, uploadService } from '../upload.service';
import { fileManagerService } from '../file-manager.service';
import { uploadProgressService } from '../upload-progress.service';
import { uploadErrorHandler } from '../upload-error-handler.service';
import { AppError } from '../../../models/error.model';
import { ErrorCode, HttpStatus } from '../../../models/constants';
import { ModelFormat } from '../../../models/model.model';

// Mock dependencies
jest.mock('../file-manager.service');
jest.mock('../upload-progress.service');
jest.mock('../upload-error-handler.service');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-upload-id')
}));

const mockFileManagerService = fileManagerService as jest.Mocked<typeof fileManagerService>;
const mockUploadProgressService = uploadProgressService as jest.Mocked<typeof uploadProgressService>;
const mockUploadErrorHandler = uploadErrorHandler as jest.Mocked<typeof uploadErrorHandler>;

const mockRequest = (overrides = {}) => ({
  file: {
    originalname: 'test-model.pkl',
    size: 1024,
    path: '/tmp/test-model.pkl',
    mimetype: 'application/octet-stream'
  },
  body: {
    modelName: 'Test Model',
    description: 'A test model',
    userId: 'user-123'
  },
  user: {
    userId: 'user-123'
  },
  ...overrides
} as unknown as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

const mockFileUploadResult = {
  modelMetadata: {
    id: 'model-123',
    name: 'Test Model',
    description: 'A test model',
    userId: 'user-123',
    fileFormat: ModelFormat.PICKLE,
    filePath: '/storage/model-123.pkl',
    endpointUrl: 'http://localhost:3000/api/predict/model-123',
    createdAt: new Date(),
    lastUsed: new Date(),
    requestCount: 0,
    status: 'active' as const
  },
  storedModel: {
    id: 'stored-123',
    originalName: 'test-model.pkl',
    storagePath: '/storage/model-123.pkl',
    fileSize: 1024,
    checksum: 'abc123',
    encryptionKey: 'key123',
    format: ModelFormat.PICKLE
  },
  validationResult: {
    isValid: true,
    isSafe: true,
    fileValidation: {
      isValid: true,
      format: 'pickle',
      errors: [],
      warnings: []
    },
    securityScan: {
      isSafe: true,
      riskLevel: 'low' as const,
      threats: [],
      scanDetails: {
        hasExecutableContent: false,
        hasSuspiciousPatterns: false,
        hasUnexpectedStructure: false
      }
    },
    overallRisk: 'low' as const,
    recommendations: ['File passed all validation and security checks. Safe to proceed.']
  }
};

describe('UploadService', () => {
  let uploadServiceInstance: UploadService;

  beforeEach(() => {
    uploadServiceInstance = new UploadService();
    jest.clearAllMocks();
    
    // Setup default mocks
    mockUploadProgressService.initializeUpload.mockReturnValue({
      uploadId: 'test-upload-id',
      fileName: 'test-model.pkl',
      totalSize: 1024,
      uploadedSize: 0,
      status: 'uploading',
      startTime: new Date(),
      estimatedTimeRemaining: null,
      uploadSpeed: 0
    });
    
    mockFileManagerService.processUploadedFile.mockResolvedValue(mockFileUploadResult);
  });

  describe('handleUpload', () => {
    it('should successfully handle file upload', async () => {
      const req = mockRequest();
      
      const result = await uploadServiceInstance.handleUpload(req);
      
      expect(result).toEqual({
        modelId: 'model-123',
        endpointUrl: 'http://localhost:3000/api/predict/model-123',
        status: 'success',
        message: 'Model uploaded successfully',
        uploadId: 'test-upload-id',
        fileInfo: {
          originalName: 'test-model.pkl',
          size: 1024,
          format: ModelFormat.PICKLE,
          checksum: 'abc123'
        },
        validationResult: {
          isValid: true,
          isSafe: true,
          riskLevel: 'low',
          recommendations: ['File passed all validation and security checks. Safe to proceed.']
        }
      });
      
      expect(mockUploadProgressService.initializeUpload).toHaveBeenCalledWith(
        'test-upload-id',
        'test-model.pkl',
        1024
      );
      expect(mockUploadProgressService.updateProgress).toHaveBeenCalled();
      expect(mockUploadProgressService.completeUpload).toHaveBeenCalledWith('test-upload-id');
    });

    it('should throw error when no file is uploaded', async () => {
      const req = mockRequest({ file: null });
      
      await expect(uploadServiceInstance.handleUpload(req)).rejects.toThrow(
        new AppError('No file uploaded', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR)
      );
    });

    it('should throw error when model name is missing', async () => {
      const req = mockRequest({ body: { description: 'Test' } });
      
      await expect(uploadServiceInstance.handleUpload(req)).rejects.toThrow(
        new AppError('Model name is required', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR)
      );
    });

    it('should handle upload errors with error handler', async () => {
      const req = mockRequest();
      const uploadError = new Error('Upload failed');
      
      mockFileManagerService.processUploadedFile.mockRejectedValue(uploadError);
      mockUploadErrorHandler.handleUploadError.mockResolvedValue({
        message: 'Upload processing failed',
        code: 'UPLOAD_ERROR'
      });
      
      await expect(uploadServiceInstance.handleUpload(req)).rejects.toThrow(AppError);
      
      expect(mockUploadErrorHandler.handleUploadError).toHaveBeenCalledWith(
        uploadError,
        expect.objectContaining({
          uploadId: 'test-upload-id',
          fileName: 'test-model.pkl',
          fileSize: 1024,
          userId: 'user-123'
        }),
        req
      );
    });

    it('should use custom base URL for endpoint generation', async () => {
      process.env.BASE_URL = 'https://api.example.com';
      const req = mockRequest();
      
      const result = await uploadServiceInstance.handleUpload(req);
      
      expect(result.endpointUrl).toBe('https://api.example.com/api/predict/model-123');
      
      delete process.env.BASE_URL;
    });
  });

  describe('getUploadProgress', () => {
    it('should return upload progress', async () => {
      const mockProgress = {
        uploadId: 'test-upload-id',
        fileName: 'test-model.pkl',
        totalSize: 1024,
        uploadedSize: 512,
        status: 'uploading' as const,
        startTime: new Date(),
        estimatedTimeRemaining: 5000,
        uploadSpeed: 102.4
      };
      
      mockUploadProgressService.getProgress.mockReturnValue(mockProgress);
      
      const result = await uploadServiceInstance.getUploadProgress('test-upload-id');
      
      expect(result).toEqual(mockProgress);
      expect(mockUploadProgressService.getProgress).toHaveBeenCalledWith('test-upload-id');
    });
  });

  describe('cancelUpload', () => {
    it('should cancel upload successfully', async () => {
      const mockProgress = {
        uploadId: 'test-upload-id',
        fileName: 'test-model.pkl',
        totalSize: 1024,
        uploadedSize: 512,
        status: 'uploading' as const,
        startTime: new Date(),
        estimatedTimeRemaining: 5000,
        uploadSpeed: 102.4
      };
      
      mockUploadProgressService.getProgress.mockReturnValue(mockProgress);
      mockUploadProgressService.cancelUpload.mockReturnValue({
        ...mockProgress,
        status: 'cancelled'
      });
      
      const result = await uploadServiceInstance.cancelUpload('test-upload-id');
      
      expect(result?.status).toBe('cancelled');
      expect(mockUploadProgressService.cancelUpload).toHaveBeenCalledWith('test-upload-id');
    });

    it('should throw error when upload not found', async () => {
      mockUploadProgressService.getProgress.mockReturnValue(null);
      
      await expect(uploadServiceInstance.cancelUpload('non-existent')).rejects.toThrow(
        new AppError('Upload not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
      );
    });

    it('should throw error when trying to cancel completed upload', async () => {
      const mockProgress = {
        uploadId: 'test-upload-id',
        fileName: 'test-model.pkl',
        totalSize: 1024,
        uploadedSize: 1024,
        status: 'completed' as const,
        startTime: new Date(),
        estimatedTimeRemaining: null,
        uploadSpeed: 102.4
      };
      
      mockUploadProgressService.getProgress.mockReturnValue(mockProgress);
      
      await expect(uploadServiceInstance.cancelUpload('test-upload-id')).rejects.toThrow(
        new AppError('Cannot cancel upload with status: completed', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR)
      );
    });
  });

  describe('validateUploadRequest', () => {
    it('should validate valid upload request', () => {
      const req = mockRequest();
      
      const result = uploadServiceInstance.validateUploadRequest(req);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing file', () => {
      const req = mockRequest({ file: null });
      
      const result = uploadServiceInstance.validateUploadRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No file uploaded');
    });

    it('should detect missing model name', () => {
      const req = mockRequest({ body: { description: 'Test' } });
      
      const result = uploadServiceInstance.validateUploadRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model name is required');
    });

    it('should detect empty model name', () => {
      const req = mockRequest({ body: { modelName: '   ', description: 'Test' } });
      
      const result = uploadServiceInstance.validateUploadRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model name is required');
    });

    it('should detect model name too long', () => {
      const longName = 'a'.repeat(256);
      const req = mockRequest({ body: { modelName: longName, description: 'Test' } });
      
      const result = uploadServiceInstance.validateUploadRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model name must be less than 255 characters');
    });

    it('should detect description too long', () => {
      const longDescription = 'a'.repeat(1001);
      const req = mockRequest({ body: { modelName: 'Test', description: longDescription } });
      
      const result = uploadServiceInstance.validateUploadRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description must be less than 1000 characters');
    });
  });

  describe('uploadHandler middleware', () => {
    it('should handle successful upload', async () => {
      const req = mockRequest();
      const res = mockResponse();
      
      await uploadServiceInstance.uploadHandler(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        modelId: 'model-123'
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const req = mockRequest({ file: null });
      const res = mockResponse();
      
      await uploadServiceInstance.uploadHandler(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle upload processing errors', async () => {
      const req = mockRequest();
      const res = mockResponse();
      
      mockFileManagerService.processUploadedFile.mockRejectedValue(new Error('Processing failed'));
      mockUploadErrorHandler.handleUploadError.mockResolvedValue({
        message: 'Upload processing failed',
        code: 'UPLOAD_ERROR'
      });
      
      await uploadServiceInstance.uploadHandler(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe('getFile', () => {
    it('should retrieve file successfully', async () => {
      const mockFileData = {
        buffer: Buffer.from('test data'),
        model: {
          originalName: 'test-model.pkl',
          format: 'pickle'
        }
      };
      
      mockFileManagerService.retrieveFile.mockResolvedValue(mockFileData);
      
      const result = await uploadServiceInstance.getFile('model-123');
      
      expect(result).toEqual({
        buffer: mockFileData.buffer,
        filename: 'test-model.pkl',
        contentType: 'application/octet-stream'
      });
      expect(mockFileManagerService.retrieveFile).toHaveBeenCalledWith('model-123');
    });

    it('should handle file retrieval errors', async () => {
      mockFileManagerService.retrieveFile.mockRejectedValue(new Error('File not found'));
      
      await expect(uploadServiceInstance.getFile('model-123')).rejects.toThrow(AppError);
    });

    it('should return correct content type for different formats', async () => {
      const testCases = [
        { format: 'keras', expected: 'application/x-hdf5' },
        { format: 'onnx', expected: 'application/x-onnx' },
        { format: 'unknown', expected: 'application/octet-stream' }
      ];
      
      for (const testCase of testCases) {
        mockFileManagerService.retrieveFile.mockResolvedValue({
          buffer: Buffer.from('test'),
          model: { originalName: 'test.model', format: testCase.format }
        });
        
        const result = await uploadServiceInstance.getFile('model-123');
        expect(result.contentType).toBe(testCase.expected);
      }
    });
  });

  describe('deleteModel', () => {
    it('should delete model successfully', async () => {
      mockFileManagerService.deleteFile.mockResolvedValue(undefined);
      
      await uploadServiceInstance.deleteModel('model-123');
      
      expect(mockFileManagerService.deleteFile).toHaveBeenCalledWith('model-123');
    });

    it('should handle deletion errors', async () => {
      mockFileManagerService.deleteFile.mockRejectedValue(new Error('Deletion failed'));
      
      await expect(uploadServiceInstance.deleteModel('model-123')).rejects.toThrow(AppError);
    });
  });

  describe('getUploadStatistics', () => {
    it('should return upload statistics', async () => {
      const result = await uploadServiceInstance.getUploadStatistics();
      
      expect(result).toEqual({
        totalUploads: 0,
        totalSize: 0,
        averageFileSize: 0,
        formatDistribution: {}
      });
    });
  });

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(uploadService).toBeInstanceOf(UploadService);
    });
  });
});