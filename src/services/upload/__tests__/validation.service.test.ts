import { ValidationService, validationService } from '../validation.service';
import { fileValidator, securityScanner } from '../file-validator';
import { AppError } from '../../../models/error.model';
import { ErrorCode, HttpStatus } from '../../../models/constants';

// Mock dependencies
jest.mock('../file-validator');

const mockFileValidator = fileValidator as jest.Mocked<typeof fileValidator>;
const mockSecurityScanner = securityScanner as jest.Mocked<typeof securityScanner>;

const mockFileValidationResult = {
  isValid: true,
  format: 'pickle',
  errors: [],
  warnings: []
};

const mockSecurityScanResult = {
  isSafe: true,
  riskLevel: 'low' as const,
  threats: [],
  scanDetails: {
    hasExecutableContent: false,
    hasSuspiciousPatterns: false,
    hasUnexpectedStructure: false
  }
};

describe('ValidationService', () => {
  let validationServiceInstance: ValidationService;

  beforeEach(() => {
    validationServiceInstance = new ValidationService();
    jest.clearAllMocks();
    
    // Setup default mocks
    mockFileValidator.validateFile.mockResolvedValue(mockFileValidationResult);
    mockSecurityScanner.scanFile.mockResolvedValue(mockSecurityScanResult);
  });

  describe('validateUploadedFile', () => {
    it('should perform comprehensive validation successfully', async () => {
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result).toEqual({
        isValid: true,
        isSafe: true,
        fileValidation: mockFileValidationResult,
        securityScan: mockSecurityScanResult,
        overallRisk: 'low',
        recommendations: ['File passed all validation and security checks. Safe to proceed.']
      });
      
      expect(mockFileValidator.validateFile).toHaveBeenCalledWith('/path/to/file.pkl');
      expect(mockSecurityScanner.scanFile).toHaveBeenCalledWith('/path/to/file.pkl');
    });

    it('should handle file validation failure', async () => {
      const invalidFileResult = {
        isValid: false,
        format: null,
        errors: ['Invalid file format'],
        warnings: []
      };
      
      mockFileValidator.validateFile.mockResolvedValue(invalidFileResult);
      
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.isValid).toBe(false);
      expect(result.overallRisk).toBe('high');
      expect(result.recommendations).toContain('File failed validation checks. Please ensure you are uploading a valid ML model file.');
    });

    it('should handle security scan failure', async () => {
      const unsafeSecurityResult = {
        isSafe: false,
        riskLevel: 'high' as const,
        threats: ['Malicious code detected'],
        scanDetails: {
          hasExecutableContent: true,
          hasSuspiciousPatterns: true,
          hasUnexpectedStructure: false
        }
      };
      
      mockSecurityScanner.scanFile.mockResolvedValue(unsafeSecurityResult);
      
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.isSafe).toBe(false);
      expect(result.overallRisk).toBe('high');
      expect(result.recommendations).toContain('File failed security scan. This file may contain malicious content.');
      expect(result.recommendations).toContain('File contains executable code. ML model files should not contain executable content.');
      expect(result.recommendations).toContain('File contains suspicious code patterns. Please verify the source and content of this file.');
    });

    it('should handle validation errors', async () => {
      mockFileValidator.validateFile.mockRejectedValue(new Error('Validation failed'));
      
      await expect(validationServiceInstance.validateUploadedFile('/path/to/file.pkl'))
        .rejects.toThrow(new AppError('File validation failed: Validation failed', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.VALIDATION_ERROR));
    });

    it('should calculate medium risk for warnings', async () => {
      const warningFileResult = {
        isValid: true,
        format: 'pickle',
        errors: [],
        warnings: ['File size is unusually large']
      };
      
      mockFileValidator.validateFile.mockResolvedValue(warningFileResult);
      
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.overallRisk).toBe('medium');
      expect(result.recommendations).toContain('File validation warnings detected. Please review the file before proceeding.');
    });

    it('should calculate medium risk for medium security risk', async () => {
      const mediumRiskSecurityResult = {
        isSafe: true,
        riskLevel: 'medium' as const,
        threats: [],
        scanDetails: {
          hasExecutableContent: false,
          hasSuspiciousPatterns: false,
          hasUnexpectedStructure: true
        }
      };
      
      mockSecurityScanner.scanFile.mockResolvedValue(mediumRiskSecurityResult);
      
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.overallRisk).toBe('medium');
      expect(result.recommendations).toContain('File structure is unexpected for the declared format. Please verify file integrity.');
      expect(result.recommendations).toContain('Medium security risk detected. Proceed with caution and additional verification.');
    });
  });

  describe('quickValidate', () => {
    it('should perform quick validation successfully', async () => {
      const result = await validationServiceInstance.quickValidate('/path/to/file.pkl');
      
      expect(result).toEqual({
        isValid: true,
        errors: []
      });
      
      expect(mockFileValidator.validateFile).toHaveBeenCalledWith('/path/to/file.pkl');
    });

    it('should handle quick validation failure', async () => {
      const invalidFileResult = {
        isValid: false,
        format: null,
        errors: ['Invalid file format', 'Corrupted file'],
        warnings: []
      };
      
      mockFileValidator.validateFile.mockResolvedValue(invalidFileResult);
      
      const result = await validationServiceInstance.quickValidate('/path/to/file.pkl');
      
      expect(result).toEqual({
        isValid: false,
        errors: ['Invalid file format', 'Corrupted file']
      });
    });

    it('should handle validation errors gracefully', async () => {
      mockFileValidator.validateFile.mockRejectedValue(new Error('Validation error'));
      
      const result = await validationServiceInstance.quickValidate('/path/to/file.pkl');
      
      expect(result).toEqual({
        isValid: false,
        errors: ['Validation failed: Validation error']
      });
    });
  });

  describe('securityScanOnly', () => {
    it('should perform security scan only', async () => {
      const result = await validationServiceInstance.securityScanOnly('/path/to/file.pkl');
      
      expect(result).toEqual(mockSecurityScanResult);
      expect(mockSecurityScanner.scanFile).toHaveBeenCalledWith('/path/to/file.pkl');
    });

    it('should handle security scan errors', async () => {
      mockSecurityScanner.scanFile.mockRejectedValue(new Error('Scan failed'));
      
      await expect(validationServiceInstance.securityScanOnly('/path/to/file.pkl'))
        .rejects.toThrow(new AppError('Security scan failed: Scan failed', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.VALIDATION_ERROR));
    });
  });

  describe('validateOrThrow', () => {
    it('should pass validation without throwing', async () => {
      const result = await validationServiceInstance.validateOrThrow('/path/to/file.pkl');
      
      expect(result.isValid).toBe(true);
      expect(result.isSafe).toBe(true);
    });

    it('should throw error for invalid file', async () => {
      const invalidFileResult = {
        isValid: false,
        format: null,
        errors: ['Invalid file format'],
        warnings: []
      };
      
      mockFileValidator.validateFile.mockResolvedValue(invalidFileResult);
      
      await expect(validationServiceInstance.validateOrThrow('/path/to/file.pkl'))
        .rejects.toThrow(new AppError('File validation failed: Invalid file format', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR));
    });

    it('should throw error for unsafe file', async () => {
      const unsafeSecurityResult = {
        isSafe: false,
        riskLevel: 'high' as const,
        threats: ['Malicious code'],
        scanDetails: {
          hasExecutableContent: true,
          hasSuspiciousPatterns: false,
          hasUnexpectedStructure: false
        }
      };
      
      mockSecurityScanner.scanFile.mockResolvedValue(unsafeSecurityResult);
      
      await expect(validationServiceInstance.validateOrThrow('/path/to/file.pkl'))
        .rejects.toThrow(new AppError('Security scan failed: Malicious code', HttpStatus.BAD_REQUEST, ErrorCode.MALICIOUS_CONTENT));
    });

    it('should throw error for high risk file', async () => {
      const highRiskSecurityResult = {
        isSafe: true,
        riskLevel: 'high' as const,
        threats: [],
        scanDetails: {
          hasExecutableContent: false,
          hasSuspiciousPatterns: true,
          hasUnexpectedStructure: true
        }
      };
      
      mockSecurityScanner.scanFile.mockResolvedValue(highRiskSecurityResult);
      
      await expect(validationServiceInstance.validateOrThrow('/path/to/file.pkl'))
        .rejects.toThrow(new AppError('File poses high security risk and cannot be processed', HttpStatus.BAD_REQUEST, ErrorCode.MALICIOUS_CONTENT));
    });
  });

  describe('getFileChecksum', () => {
    it('should calculate file checksum', async () => {
      mockFileValidator.calculateChecksum.mockResolvedValue('abc123def456');
      
      const result = await validationServiceInstance.getFileChecksum('/path/to/file.pkl');
      
      expect(result).toBe('abc123def456');
      expect(mockFileValidator.calculateChecksum).toHaveBeenCalledWith('/path/to/file.pkl');
    });

    it('should handle checksum calculation errors', async () => {
      mockFileValidator.calculateChecksum.mockRejectedValue(new Error('Checksum failed'));
      
      await expect(validationServiceInstance.getFileChecksum('/path/to/file.pkl'))
        .rejects.toThrow(new AppError('Failed to calculate file checksum: Checksum failed', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.STORAGE_ERROR));
    });
  });

  describe('validateFormat', () => {
    it('should validate file format', async () => {
      mockFileValidator.validateFileFormat.mockResolvedValue({
        format: 'pickle',
        isValid: true
      });
      
      const result = await validationServiceInstance.validateFormat('/path/to/file.pkl');
      
      expect(result).toEqual({
        format: 'pickle',
        isValid: true
      });
      expect(mockFileValidator.validateFileFormat).toHaveBeenCalledWith('/path/to/file.pkl');
    });

    it('should handle format validation errors', async () => {
      mockFileValidator.validateFileFormat.mockRejectedValue(new Error('Format validation failed'));
      
      await expect(validationServiceInstance.validateFormat('/path/to/file.pkl'))
        .rejects.toThrow(new AppError('Format validation failed: Format validation failed', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.VALIDATION_ERROR));
    });
  });

  describe('risk calculation', () => {
    it('should calculate high risk for invalid and unsafe files', async () => {
      const invalidFileResult = { isValid: false, format: null, errors: ['Invalid'], warnings: [] };
      const unsafeSecurityResult = {
        isSafe: false,
        riskLevel: 'high' as const,
        threats: ['Threat'],
        scanDetails: { hasExecutableContent: true, hasSuspiciousPatterns: true, hasUnexpectedStructure: true }
      };
      
      mockFileValidator.validateFile.mockResolvedValue(invalidFileResult);
      mockSecurityScanner.scanFile.mockResolvedValue(unsafeSecurityResult);
      
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.overallRisk).toBe('high');
    });

    it('should calculate medium risk for valid files with warnings', async () => {
      const warningFileResult = {
        isValid: true,
        format: 'pickle',
        errors: [],
        warnings: ['Large file size']
      };
      
      const mediumRiskSecurityResult = {
        isSafe: true,
        riskLevel: 'medium' as const,
        threats: [],
        scanDetails: {
          hasExecutableContent: false,
          hasSuspiciousPatterns: false,
          hasUnexpectedStructure: true
        }
      };
      
      mockFileValidator.validateFile.mockResolvedValue(warningFileResult);
      mockSecurityScanner.scanFile.mockResolvedValue(mediumRiskSecurityResult);
      
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.overallRisk).toBe('medium');
    });

    it('should calculate low risk for valid and safe files', async () => {
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.overallRisk).toBe('low');
    });
  });

  describe('recommendations generation', () => {
    it('should generate comprehensive recommendations for high-risk files', async () => {
      const invalidFileResult = {
        isValid: false,
        format: null,
        errors: ['Invalid format'],
        warnings: ['Large size']
      };
      
      const unsafeSecurityResult = {
        isSafe: false,
        riskLevel: 'high' as const,
        threats: ['Malicious code'],
        scanDetails: {
          hasExecutableContent: true,
          hasSuspiciousPatterns: true,
          hasUnexpectedStructure: true
        }
      };
      
      mockFileValidator.validateFile.mockResolvedValue(invalidFileResult);
      mockSecurityScanner.scanFile.mockResolvedValue(unsafeSecurityResult);
      
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.recommendations).toContain('File failed validation checks. Please ensure you are uploading a valid ML model file.');
      expect(result.recommendations).toContain('File validation warnings detected. Please review the file before proceeding.');
      expect(result.recommendations).toContain('File failed security scan. This file may contain malicious content.');
      expect(result.recommendations).toContain('File contains executable code. ML model files should not contain executable content.');
      expect(result.recommendations).toContain('File contains suspicious code patterns. Please verify the source and content of this file.');
      expect(result.recommendations).toContain('File structure is unexpected for the declared format. Please verify file integrity.');
      expect(result.recommendations).toContain('High security risk detected. Do not proceed with this file.');
    });

    it('should generate positive recommendation for safe files', async () => {
      const result = await validationServiceInstance.validateUploadedFile('/path/to/file.pkl');
      
      expect(result.recommendations).toEqual(['File passed all validation and security checks. Safe to proceed.']);
    });
  });

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(validationService).toBeInstanceOf(ValidationService);
    });
  });
});