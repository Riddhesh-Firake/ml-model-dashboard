import { ModelValidatorService, ValidationResult } from '../model-validator.service';
import { ModelMetadata, ModelFormat } from '../../../models';
import { promises as fs } from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    readFile: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ModelValidatorService', () => {
  let service: ModelValidatorService;
  let mockMetadata: ModelMetadata;

  beforeEach(() => {
    service = new ModelValidatorService();
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

    jest.clearAllMocks();
  });

  describe('validateModel', () => {
    it('should validate a valid model successfully', async () => {
      const mockStats = {
        size: 1024 * 1024, // 1MB
        isFile: () => true
      };

      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.readFile.mockResolvedValue(Buffer.from([0x80, 0x03, 0x00, 0x00])); // Mock pickle header

      const result = await service.validateModel(mockMetadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.fileSize).toBe(1024 * 1024);
      expect(result.metadata!.format).toBe(ModelFormat.PICKLE);
    });

    it('should reject file that is too large', async () => {
      const mockStats = {
        size: 600 * 1024 * 1024, // 600MB (exceeds 500MB limit)
        isFile: () => true
      };

      mockFs.stat.mockResolvedValue(mockStats as any);

      const result = await service.validateModel(mockMetadata);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum allowed size');
    });

    it('should reject unsupported format', async () => {
      const invalidMetadata = {
        ...mockMetadata,
        fileFormat: 'invalid' as ModelFormat
      };

      const mockStats = {
        size: 1024,
        isFile: () => true
      };

      mockFs.stat.mockResolvedValue(mockStats as any);

      const result = await service.validateModel(invalidMetadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported model format: invalid');
    });

    it('should reject file with wrong extension', async () => {
      const invalidMetadata = {
        ...mockMetadata,
        filePath: '/path/to/model.txt', // Wrong extension for pickle
        fileFormat: ModelFormat.PICKLE
      };

      const mockStats = {
        size: 1024,
        isFile: () => true
      };

      mockFs.stat.mockResolvedValue(mockStats as any);

      const result = await service.validateModel(invalidMetadata);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('does not match declared format');
    });

    it('should handle file access errors', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));

      const result = await service.validateModel(mockMetadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Failed to access model file: File not found');
    });

    it('should add warnings for large models', async () => {
      const mockStats = {
        size: 150 * 1024 * 1024, // 150MB
        isFile: () => true
      };

      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.readFile.mockResolvedValue(Buffer.from([0x80, 0x03, 0x00, 0x00]));

      const result = await service.validateModel(mockMetadata);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large model file may impact loading performance');
    });
  });

  describe('validateInputData', () => {
    it('should validate valid input data', async () => {
      const inputData = { data: [1, 2, 3, 4] };
      const inputSchema = {
        type: 'object',
        properties: {
          data: { type: 'array' }
        },
        required: ['data']
      };

      const result = await service.validateInputData('model-1', inputData, inputSchema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined input', async () => {
      const result1 = await service.validateInputData('model-1', null);
      const result2 = await service.validateInputData('model-1', undefined);

      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Input data is required');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Input data is required');
    });

    it('should validate against schema when provided', async () => {
      const inputData = { wrongField: [1, 2, 3] };
      const inputSchema = {
        type: 'object',
        properties: {
          data: { type: 'array' }
        },
        required: ['data']
      };

      const result = await service.validateInputData('model-1', inputData, inputSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Required field 'data' is missing");
    });

    it('should add warnings for non-standard input format', async () => {
      const inputData = { someField: 'value' };

      const result = await service.validateInputData('model-1', inputData);

      expect(result.isValid).toBe(true);
      expect(result.warnings[0]).toContain('should typically contain');
    });
  });

  describe('format-specific validation', () => {
    describe('Pickle validation', () => {
      it('should validate pickle file header', async () => {
        const mockStats = { size: 1024, isFile: () => true };
        const pickleHeader = Buffer.from([0x80, 0x03, 0x00, 0x00]); // Valid pickle header

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(pickleHeader);

        const result = await service.validateModel(mockMetadata);

        expect(result.isValid).toBe(true);
        expect(result.warnings).not.toContain(expect.stringContaining('not be a valid pickle file'));
      });

      it('should warn about invalid pickle header', async () => {
        const mockStats = { size: 1024, isFile: () => true };
        const invalidHeader = Buffer.from([0x00, 0x00, 0x00, 0x00]); // Invalid header

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(invalidHeader);

        const result = await service.validateModel(mockMetadata);

        expect(result.isValid).toBe(true); // Still valid, just a warning
        expect(result.warnings[0]).toContain('not be a valid pickle file');
      });
    });

    describe('Keras validation', () => {
      it('should validate HDF5 file header', async () => {
        const kerasMetadata = { ...mockMetadata, fileFormat: ModelFormat.KERAS, filePath: '/path/to/model.h5' };
        const mockStats = { size: 1024, isFile: () => true };
        const hdf5Header = Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]); // Valid HDF5 header

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(hdf5Header);

        const result = await service.validateModel(kerasMetadata);

        expect(result.isValid).toBe(true);
      });

      it('should reject invalid HDF5 header', async () => {
        const kerasMetadata = { ...mockMetadata, fileFormat: ModelFormat.KERAS, filePath: '/path/to/model.h5' };
        const mockStats = { size: 1024, isFile: () => true };
        const invalidHeader = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(invalidHeader);

        const result = await service.validateModel(kerasMetadata);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File is not a valid HDF5/Keras model file');
      });
    });

    describe('PyTorch validation', () => {
      it('should validate PyTorch ZIP format', async () => {
        const pytorchMetadata = { ...mockMetadata, fileFormat: ModelFormat.PYTORCH, filePath: '/path/to/model.pt' };
        const mockStats = { size: 1024, isFile: () => true };
        const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP signature

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(zipHeader);

        const result = await service.validateModel(pytorchMetadata);

        expect(result.isValid).toBe(true);
      });

      it('should handle PyTorch pickle format with warning', async () => {
        const pytorchMetadata = { ...mockMetadata, fileFormat: ModelFormat.PYTORCH, filePath: '/path/to/model.pt' };
        const mockStats = { size: 1024, isFile: () => true };
        const pickleHeader = Buffer.from([0x80, 0x03, 0x00, 0x00]); // Pickle signature

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(pickleHeader);

        const result = await service.validateModel(pytorchMetadata);

        expect(result.isValid).toBe(true);
        expect(result.warnings[0]).toContain('pickle format');
      });
    });

    describe('ONNX validation', () => {
      it('should validate ONNX file size', async () => {
        const onnxMetadata = { ...mockMetadata, fileFormat: ModelFormat.ONNX, filePath: '/path/to/model.onnx' };
        const mockStats = { size: 1024, isFile: () => true };
        const validBuffer = Buffer.alloc(1024);

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(validBuffer);

        const result = await service.validateModel(onnxMetadata);

        expect(result.isValid).toBe(true);
      });

      it('should reject ONNX file that is too small', async () => {
        const onnxMetadata = { ...mockMetadata, fileFormat: ModelFormat.ONNX, filePath: '/path/to/model.onnx' };
        const mockStats = { size: 5, isFile: () => true };
        const tinyBuffer = Buffer.alloc(5);

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(tinyBuffer);

        const result = await service.validateModel(onnxMetadata);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('ONNX file appears to be too small to be valid');
      });
    });
  });

  describe('memory estimation', () => {
    it('should estimate memory usage correctly for different formats', async () => {
      const testCases = [
        { format: ModelFormat.PICKLE, fileSize: 1024 * 1024, expectedMultiplier: 2.5 },
        { format: ModelFormat.JOBLIB, fileSize: 1024 * 1024, expectedMultiplier: 2.0 },
        { format: ModelFormat.KERAS, fileSize: 1024 * 1024, expectedMultiplier: 1.5 },
        { format: ModelFormat.ONNX, fileSize: 1024 * 1024, expectedMultiplier: 1.8 },
        { format: ModelFormat.PYTORCH, fileSize: 1024 * 1024, expectedMultiplier: 2.0 }
      ];

      for (const testCase of testCases) {
        const metadata = { ...mockMetadata, fileFormat: testCase.format };
        const mockStats = { size: testCase.fileSize, isFile: () => true };

        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue(Buffer.alloc(100));

        const result = await service.validateModel(metadata);

        expect(result.metadata!.estimatedMemoryUsage).toBe(
          Math.round(testCase.fileSize * testCase.expectedMultiplier)
        );
      }
    });

    it('should warn about high memory usage models', async () => {
      const largeSize = 600 * 1024 * 1024; // 600MB file
      const mockStats = { size: largeSize, isFile: () => true };

      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.readFile.mockResolvedValue(Buffer.from([0x80, 0x03, 0x00, 0x00]));

      const result = await service.validateModel(mockMetadata);

      expect(result.warnings).toContain('Model may require significant memory resources');
    });
  });

  describe('extension validation', () => {
    const validExtensions = [
      { format: ModelFormat.PICKLE, extensions: ['pkl', 'pickle'] },
      { format: ModelFormat.JOBLIB, extensions: ['joblib', 'pkl'] },
      { format: ModelFormat.KERAS, extensions: ['h5', 'hdf5'] },
      { format: ModelFormat.ONNX, extensions: ['onnx'] },
      { format: ModelFormat.PYTORCH, extensions: ['pt', 'pth'] },
      { format: ModelFormat.PYTORCH_STATE, extensions: ['pth', 'pt'] }
    ];

    validExtensions.forEach(({ format, extensions }) => {
      extensions.forEach(ext => {
        it(`should accept .${ext} extension for ${format} format`, async () => {
          const metadata = { ...mockMetadata, fileFormat: format, filePath: `/path/to/model.${ext}` };
          const mockStats = { size: 1024, isFile: () => true };

          mockFs.stat.mockResolvedValue(mockStats as any);
          mockFs.readFile.mockResolvedValue(Buffer.alloc(100));

          const result = await service.validateModel(metadata);

          expect(result.errors).not.toContain(expect.stringContaining('does not match declared format'));
        });
      });
    });
  });
});