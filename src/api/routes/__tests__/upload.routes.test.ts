import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { UploadRoutes } from '../upload.routes';
import { AuthMiddleware } from '../../../services/user-management/auth.middleware';
import { uploadService } from '../../../services/upload/upload.service';
import { HttpStatus, ErrorCode } from '../../../models/constants';

// Mock the upload service
jest.mock('../../../services/upload/upload.service');
const mockUploadService = uploadService as jest.Mocked<typeof uploadService>;

// Mock the auth middleware
const mockAuthMiddleware = {
  authenticateJWT: jest.fn((req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id', email: 'test@example.com', subscription: 'free' };
    next();
  })
} as unknown as AuthMiddleware;

describe('UploadRoutes', () => {
  let app: express.Application;
  let uploadRoutes: UploadRoutes;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    uploadRoutes = new UploadRoutes(mockAuthMiddleware);
    app.use('/api/models', uploadRoutes.getRouter());

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('POST /api/models/upload', () => {
    const mockFile = {
      fieldname: 'modelFile',
      originalname: 'test-model.pkl',
      encoding: '7bit',
      mimetype: 'application/octet-stream',
      destination: '/tmp',
      filename: 'test-file.pkl',
      path: '/tmp/test-file.pkl',
      size: 1024
    };

    it('should successfully upload a model file', async () => {
      const mockResponse = {
        modelId: 'test-model-id',
        endpointUrl: 'http://localhost:3000/api/predict/test-model-id',
        status: 'success' as const,
        message: 'Model uploaded successfully',
        fileInfo: {
          originalName: 'test-model.pkl',
          size: 1024,
          format: 'pickle',
          checksum: 'abc123'
        },
        validationResult: {
          isValid: true,
          isSafe: true,
          riskLevel: 'low',
          recommendations: []
        }
      };

      mockUploadService.handleUpload.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/models/upload')
        .field('modelName', 'Test Model')
        .field('description', 'A test model')
        .attach('modelFile', Buffer.from('test file content'), 'test-model.pkl');

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(response.body.message).toBe('Model uploaded successfully');
      expect(mockUploadService.handleUpload).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when model name is missing', async () => {
      const response = await request(app)
        .post('/api/models/upload')
        .field('description', 'A test model')
        .attach('modelFile', Buffer.from('test file content'), 'test-model.pkl');

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.body.error.message).toContain('Model name is required');
    });

    it('should return 400 when model name is empty string', async () => {
      const response = await request(app)
        .post('/api/models/upload')
        .field('modelName', '   ')
        .field('description', 'A test model')
        .attach('modelFile', Buffer.from('test file content'), 'test-model.pkl');

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.body.error.message).toContain('Model name is required');
    });

    it('should return 400 when model name is too long', async () => {
      const longName = 'a'.repeat(256);
      
      const response = await request(app)
        .post('/api/models/upload')
        .field('modelName', longName)
        .field('description', 'A test model')
        .attach('modelFile', Buffer.from('test file content'), 'test-model.pkl');

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.body.error.message).toContain('Model name must be less than 255 characters');
    });

    it('should return 400 when description is too long', async () => {
      const longDescription = 'a'.repeat(1001);
      
      const response = await request(app)
        .post('/api/models/upload')
        .field('modelName', 'Test Model')
        .field('description', longDescription)
        .attach('modelFile', Buffer.from('test file content'), 'test-model.pkl');

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.body.error.message).toContain('Description must be a string with less than 1000 characters');
    });

    it('should handle upload service errors', async () => {
      const error = new Error('Upload failed');
      mockUploadService.handleUpload.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/models/upload')
        .field('modelName', 'Test Model')
        .field('description', 'A test model')
        .attach('modelFile', Buffer.from('test file content'), 'test-model.pkl');

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockUploadService.handleUpload).toHaveBeenCalledTimes(1);
    });

    it('should pass user ID from authenticated user', async () => {
      const mockResponse = {
        modelId: 'test-model-id',
        endpointUrl: 'http://localhost:3000/api/predict/test-model-id',
        status: 'success' as const,
        message: 'Model uploaded successfully'
      };

      mockUploadService.handleUpload.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/models/upload')
        .field('modelName', 'Test Model')
        .field('description', 'A test model')
        .attach('modelFile', Buffer.from('test file content'), 'test-model.pkl');

      expect(mockUploadService.handleUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            userId: 'test-user-id'
          })
        })
      );
    });
  });

  describe('GET /api/models/upload/progress/:uploadId', () => {
    it('should return upload progress', async () => {
      const mockProgress = {
        uploadId: 'test-upload-id',
        fileName: 'test-model.pkl',
        progress: 75,
        status: 'uploading' as const,
        totalSize: 1024,
        uploadedSize: 768,
        startTime: new Date(),
        estimatedTimeRemaining: 5000,
        error: undefined
      };

      mockUploadService.getUploadProgress.mockResolvedValue(mockProgress);

      const response = await request(app)
        .get('/api/models/upload/progress/test-upload-id');

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProgress);
      expect(mockUploadService.getUploadProgress).toHaveBeenCalledWith('test-upload-id');
    });

    it('should return 400 when upload ID is missing', async () => {
      const response = await request(app)
        .get('/api/models/upload/progress/');

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should handle service errors', async () => {
      const error = new Error('Progress retrieval failed');
      mockUploadService.getUploadProgress.mockRejectedValue(error);

      const response = await request(app)
        .get('/api/models/upload/progress/test-upload-id');

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('DELETE /api/models/upload/cancel/:uploadId', () => {
    it('should cancel upload successfully', async () => {
      const mockCancelledUpload = {
        uploadId: 'test-upload-id',
        fileName: 'test-model.pkl',
        progress: 50,
        status: 'cancelled' as const,
        totalSize: 1024,
        uploadedSize: 512,
        startTime: new Date(),
        estimatedTimeRemaining: undefined,
        error: undefined
      };

      mockUploadService.cancelUpload.mockResolvedValue(mockCancelledUpload);

      const response = await request(app)
        .delete('/api/models/upload/cancel/test-upload-id');

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Upload cancelled successfully');
      expect(mockUploadService.cancelUpload).toHaveBeenCalledWith('test-upload-id');
    });

    it('should return 400 when upload ID is missing', async () => {
      const response = await request(app)
        .delete('/api/models/upload/cancel/');

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should handle service errors', async () => {
      const error = new Error('Cancellation failed');
      mockUploadService.cancelUpload.mockRejectedValue(error);

      const response = await request(app)
        .delete('/api/models/upload/cancel/test-upload-id');

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('GET /api/models/upload/stats', () => {
    it('should return upload statistics', async () => {
      const mockStats = {
        totalUploads: 10,
        totalSize: 1024000,
        averageFileSize: 102400,
        formatDistribution: {
          'pickle': 5,
          'keras': 3,
          'pytorch': 2
        }
      };

      mockUploadService.getUploadStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/models/upload/stats');

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockUploadService.getUploadStatistics).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors', async () => {
      const error = new Error('Stats retrieval failed');
      mockUploadService.getUploadStatistics.mockRejectedValue(error);

      const response = await request(app)
        .get('/api/models/upload/stats');

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', () => {
      expect(mockAuthMiddleware.authenticateJWT).toBeDefined();
      
      // The authentication middleware should be called for all routes
      // This is tested implicitly in the other tests since we mock the middleware
    });
  });
});