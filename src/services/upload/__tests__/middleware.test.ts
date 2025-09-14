import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { 
  getFileExtension, 
  getModelFormat, 
  getSupportedExtensions, 
  uploadMiddleware,
  validateFileSize,
  handleUploadErrors,
  validateUploadedFile,
  cleanupTempFile
} from '../upload.middleware';
import { storageConfig } from '../../../config/storage.config';
import { AppError } from '../../../models/error.model';
import { HttpStatus, ErrorCode } from '../../../models/constants';

// Mock the storage config for testing
jest.mock('../../../config/storage.config', () => ({
  storageConfig: {
    test: {
      provider: 'local',
      basePath: './test-uploads',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFormats: ['pkl', 'joblib', 'h5', 'onnx', 'pt', 'pth'],
      encryptionEnabled: false,
    }
  }
}));

describe('Upload Middleware', () => {
  let app: express.Application;
  const testUploadDir = './test-uploads';
  const testTempDir = path.join(testUploadDir, 'temp');

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Create test directories
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Test route with upload middleware
    app.post('/test-upload', uploadMiddleware, (req: express.Request, res: express.Response) => {
      res.json({
        success: true,
        file: req.file ? {
          filename: req.file.filename,
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        } : null
      });
    });

    // Error handling middleware
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    });
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testTempDir)) {
      const files = fs.readdirSync(testTempDir);
      files.forEach(file => {
        const filePath = path.join(testTempDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
  });

  afterAll(() => {
    // Clean up test directories
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  describe('File Upload Integration', () => {
    it('should successfully upload a valid .pkl file', async () => {
      // Create a test file
      const testFilePath = path.join(__dirname, 'test-model.pkl');
      fs.writeFileSync(testFilePath, 'mock pickle data');

      const response = await request(app)
        .post('/test-upload')
        .attach('modelFile', testFilePath)
        .field('modelName', 'Test Model')
        .field('description', 'Test description');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file).toBeDefined();
      expect(response.body.file.originalname).toBe('test-model.pkl');

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });

    it('should successfully upload a valid .h5 file', async () => {
      const testFilePath = path.join(__dirname, 'test-model.h5');
      fs.writeFileSync(testFilePath, 'mock keras data');

      const response = await request(app)
        .post('/test-upload')
        .attach('modelFile', testFilePath)
        .field('modelName', 'Keras Model');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file.originalname).toBe('test-model.h5');

      fs.unlinkSync(testFilePath);
    });

    it('should reject unsupported file formats', async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'not a model file');

      const response = await request(app)
        .post('/test-upload')
        .attach('modelFile', testFilePath)
        .field('modelName', 'Invalid Model');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.UNSUPPORTED_FORMAT);

      fs.unlinkSync(testFilePath);
    });

    it('should reject files that are too large', async () => {
      const testFilePath = path.join(__dirname, 'large-model.pkl');
      // Create a file larger than 10MB (test limit)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');
      fs.writeFileSync(testFilePath, largeBuffer);

      const response = await request(app)
        .post('/test-upload')
        .attach('modelFile', testFilePath)
        .field('modelName', 'Large Model');

      expect(response.status).toBe(413);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.FILE_TOO_LARGE);

      fs.unlinkSync(testFilePath);
    });

    it('should reject requests without files', async () => {
      const response = await request(app)
        .post('/test-upload')
        .field('modelName', 'No File Model');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.body.error.message).toContain('No file uploaded');
    });

    it('should reject multiple files', async () => {
      const testFilePath1 = path.join(__dirname, 'test-model1.pkl');
      const testFilePath2 = path.join(__dirname, 'test-model2.pkl');
      fs.writeFileSync(testFilePath1, 'mock data 1');
      fs.writeFileSync(testFilePath2, 'mock data 2');

      try {
        const response = await request(app)
          .post('/test-upload')
          .attach('modelFile', testFilePath1)
          .attach('anotherFile', testFilePath2)
          .field('modelName', 'Multiple Files')
          .timeout(3000);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      } finally {
        // Clean up test files
        if (fs.existsSync(testFilePath1)) fs.unlinkSync(testFilePath1);
        if (fs.existsSync(testFilePath2)) fs.unlinkSync(testFilePath2);
      }
    }, 10000);
  });

  describe('Utility Functions', () => {
    describe('getFileExtension', () => {
      it('should extract file extension correctly', () => {
        expect(getFileExtension('model.pkl')).toBe('.pkl');
        expect(getFileExtension('model.h5')).toBe('.h5');
        expect(getFileExtension('MODEL.PKL')).toBe('.pkl');
        expect(getFileExtension('test.file.onnx')).toBe('.onnx');
        expect(getFileExtension('no-extension')).toBe('');
      });
    });

    describe('getModelFormat', () => {
      it('should determine model format from filename', () => {
        expect(getModelFormat('model.pkl')).toBe('pickle');
        expect(getModelFormat('model.h5')).toBe('keras');
        expect(getModelFormat('model.onnx')).toBe('onnx');
        expect(getModelFormat('model.pt')).toBe('pytorch');
        expect(getModelFormat('model.pth')).toBe('pytorch');
        expect(getModelFormat('model.joblib')).toBe('joblib');
        expect(getModelFormat('model.txt')).toBeNull();
      });
    });

    describe('getSupportedExtensions', () => {
      it('should return supported extensions', () => {
        const extensions = getSupportedExtensions();
        expect(extensions).toContain('.pkl');
        expect(extensions).toContain('.h5');
        expect(extensions).toContain('.onnx');
        expect(extensions).toContain('.pt');
        expect(extensions).toContain('.joblib');
        expect(extensions).toContain('.pth');
        expect(extensions.length).toBeGreaterThan(0);
      });
    });

    describe('validateFileSize', () => {
      it('should validate file sizes correctly', () => {
        const testConfig = storageConfig.test;
        if (!testConfig) {
          throw new Error('Test configuration not found');
        }
        const maxSize = testConfig.maxFileSize;
        expect(validateFileSize(maxSize - 1)).toBe(true);
        expect(validateFileSize(maxSize)).toBe(true);
        expect(validateFileSize(maxSize + 1)).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle multer file size errors correctly', () => {
      const mockReq = {} as express.Request;
      const mockRes = {} as express.Response;
      const mockNext = jest.fn();

      // Create a proper MulterError mock
      const multerError = {
        name: 'MulterError',
        code: 'LIMIT_FILE_SIZE',
        message: 'File too large'
      };

      handleUploadErrors(multerError, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const calledError = mockNext.mock.calls[0][0];
      expect(calledError.code).toBe(ErrorCode.FILE_TOO_LARGE);
    });

    it('should handle unexpected file field errors', () => {
      const mockReq = {} as express.Request;
      const mockRes = {} as express.Response;
      const mockNext = jest.fn();

      const multerError = {
        name: 'MulterError',
        code: 'LIMIT_UNEXPECTED_FILE',
        message: 'Unexpected field'
      };

      handleUploadErrors(multerError, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const calledError = mockNext.mock.calls[0][0];
      expect(calledError.message).toContain('modelFile');
    });

    it('should handle AppError instances', () => {
      const mockReq = {} as express.Request;
      const mockRes = {} as express.Response;
      const mockNext = jest.fn();

      const appError = new AppError('Test error', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

      handleUploadErrors(appError, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(appError);
    });

    it('should handle generic errors', () => {
      const mockReq = {} as express.Request;
      const mockRes = {} as express.Response;
      const mockNext = jest.fn();

      const genericError = new Error('Generic error');

      handleUploadErrors(genericError, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const calledError = mockNext.mock.calls[0][0];
      expect(calledError.code).toBe(ErrorCode.STORAGE_ERROR);
    });
  });

  describe('File Validation', () => {
    it('should pass validation with uploaded file', () => {
      const mockReq = {
        file: {
          filename: 'test.pkl',
          originalname: 'test.pkl',
          size: 1000
        }
      } as express.Request;
      const mockRes = {} as express.Response;
      const mockNext = jest.fn();

      validateUploadedFile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail validation without uploaded file', () => {
      const mockReq = {} as express.Request;
      const mockRes = {} as express.Response;
      const mockNext = jest.fn();

      validateUploadedFile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const calledError = mockNext.mock.calls[0][0];
      expect(calledError.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('Cleanup Middleware', () => {
    it('should setup cleanup for temp files', () => {
      const mockReq = {
        file: {
          path: '/temp/test-file.pkl'
        }
      } as express.Request;
      
      const mockRes = {
        statusCode: 200,
        end: jest.fn()
      } as any;
      
      const mockNext = jest.fn();
      const originalEnd = mockRes.end;

      cleanupTempFile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.end).not.toBe(originalEnd);
    });
  });
});