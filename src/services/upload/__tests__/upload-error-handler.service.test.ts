import { Request, Response, NextFunction } from 'express';
import { UploadErrorHandlerService, UploadErrorContext } from '../upload-error-handler.service';
import { AppError } from '../../../models/error.model';
import { ErrorCode, HttpStatus } from '../../../models/constants';
import { uploadProgressService } from '../upload-progress.service';
import { tempFileManager } from '../temp-file.manager';

// Mock dependencies
jest.mock('../upload-progress.service');
jest.mock('../temp-file.manager');

const mockUploadProgressService = uploadProgressService as jest.Mocked<typeof uploadProgressService>;
const mockTempFileManager = tempFileManager as jest.Mocked<typeof tempFileManager>;

describe('UploadErrorHandlerService', () => {
  let service: UploadErrorHandlerService;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    service = new UploadErrorHandlerService();
    mockReq = {
      path: '/api/models/upload',
      file: {
        originalname: 'test-model.pkl',
        size: 1024,
        path: '/tmp/test-file'
      } as Express.Multer.File,
      body: { uploadId: 'test-upload-id' },
      user: { userId: 'test-user-id', email: 'test@example.com', subscription: 'free' }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('handleUploadError', () => {
    it('should handle AppError correctly', async () => {
      const error = new AppError('Validation failed', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
      const context: UploadErrorContext = {
        uploadId: 'test-upload-id',
        fileName: 'test-model.pkl',
        fileSize: 1024,
        userId: 'test-user-id',
        stage: 'validation'
      };

      mockUploadProgressService.failUpload.mockReturnValue(null);
      mockTempFileManager.cleanupFile.mockResolvedValue();

      const result = await service.handleUploadError(error, context);

      expect(result).toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        stage: 'validation',
        timestamp: expect.any(String)
      });

      expect(mockUploadProgressService.failUpload).toHaveBeenCalledWith('test-upload-id', 'Validation failed');
    });

    it('should handle generic Error with user-friendly message', async () => {
      const error = new Error('ENOENT: no such file or directory');
      const context: UploadErrorContext = {
        uploadId: 'test-upload-id',
        fileName: 'test-model.pkl',
        stage: 'storage'
      };

      mockUploadProgressService.failUpload.mockReturnValue(null);

      const result = await service.handleUploadError(error, context);

      expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(result.message).toBe('The uploaded file could not be found. Please try uploading again.');
      expect(result.suggestions).toContain('Try uploading again');
    });

    it('should cleanup temporary files', async () => {
      const error = new Error('Test error');
      const context: UploadErrorContext = {
        uploadId: 'test-upload-id',
        tempFilePath: '/tmp/test-file',
        stage: 'processing'
      };

      mockUploadProgressService.failUpload.mockReturnValue(null);
      mockTempFileManager.cleanupFile.mockResolvedValue();

      await service.handleUploadError(error, context, mockReq as Request);

      expect(mockTempFileManager.cleanupFile).toHaveBeenCalledWith('/tmp/test-file');
      expect(mockTempFileManager.cleanupFile).toHaveBeenCalledWith('/tmp/test-file'); // Called twice - once for context, once for req.file
    });

    it('should generate appropriate suggestions for different error types', async () => {
      const error = new AppError('File too large', HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.FILE_TOO_LARGE);
      const context: UploadErrorContext = {
        stage: 'upload'
      };

      mockUploadProgressService.failUpload.mockReturnValue(null);

      const result = await service.handleUploadError(error, context);

      expect(result.suggestions).toContain('Compress your model file if possible');
      expect(result.suggestions).toContain('Use a more efficient model format (e.g., ONNX)');
    });
  });

  describe('uploadErrorMiddleware', () => {
    it('should handle upload-related errors', async () => {
      const error = new AppError('Upload failed', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

      mockUploadProgressService.failUpload.mockReturnValue(null);
      mockTempFileManager.cleanupFile.mockResolvedValue();

      await service.uploadErrorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Upload failed',
          stage: expect.any(String)
        }),
        message: 'Upload failed'
      });
    });

    it('should pass non-upload errors to next middleware', async () => {
      const error = new Error('Non-upload error');
      mockReq.path = '/api/other';
      mockReq.file = undefined;

      await service.uploadErrorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle errors in error handling gracefully', async () => {
      const error = new Error('Test error');
      
      // Mock uploadProgressService to throw an error
      mockUploadProgressService.failUpload.mockImplementation(() => {
        throw new Error('Progress service error');
      });

      await service.uploadErrorMiddleware(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
          stage: 'error_handling',
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('error mapping and messages', () => {
    it('should map file system errors correctly', async () => {
      const testCases = [
        { error: 'ENOENT', expectedCode: ErrorCode.FILE_NOT_FOUND },
        { error: 'EACCES', expectedCode: ErrorCode.PERMISSION_DENIED },
        { error: 'ENOSPC', expectedCode: ErrorCode.STORAGE_FULL },
        { error: 'timeout', expectedCode: ErrorCode.TIMEOUT_ERROR }
      ];

      for (const testCase of testCases) {
        const error = new Error(testCase.error);
        const context: UploadErrorContext = { stage: 'storage' };

        mockUploadProgressService.failUpload.mockReturnValue(null);

        const result = await service.handleUploadError(error, context);

        expect(result.code).toBe(testCase.expectedCode);
      }
    });

    it('should provide stage-specific error messages', async () => {
      const stages: UploadErrorContext['stage'][] = ['validation', 'upload', 'processing', 'storage', 'database'];

      for (const stage of stages) {
        const error = new Error('Generic error');
        const context: UploadErrorContext = { stage };

        mockUploadProgressService.failUpload.mockReturnValue(null);

        const result = await service.handleUploadError(error, context);

        expect(result.message).toBeTruthy();
        expect(result.stage).toBe(stage);
      }
    });
  });

  describe('getErrorStatistics', () => {
    it('should return error statistics', () => {
      const stats = service.getErrorStatistics();

      expect(stats).toEqual({
        totalErrors: 0,
        errorsByStage: {},
        errorsByCode: {},
        recentErrors: []
      });
    });
  });
});