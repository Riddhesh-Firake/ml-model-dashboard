import { fileValidator, securityScanner, FileValidationResult, SecurityScanResult } from './file-validator';
import { AppError } from '../../models/error.model';
import { ErrorCode, HttpStatus } from '../../models/constants';

export interface ComprehensiveValidationResult {
  isValid: boolean;
  isSafe: boolean;
  fileValidation: FileValidationResult;
  securityScan: SecurityScanResult;
  overallRisk: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export class ValidationService {
  /**
   * Perform comprehensive validation including file format and security scanning
   */
  async validateUploadedFile(filePath: string): Promise<ComprehensiveValidationResult> {
    try {
      // Run file validation and security scan in parallel
      const [fileValidation, securityScan] = await Promise.all([
        fileValidator.validateFile(filePath),
        securityScanner.scanFile(filePath)
      ]);

      const result: ComprehensiveValidationResult = {
        isValid: fileValidation.isValid,
        isSafe: securityScan.isSafe,
        fileValidation,
        securityScan,
        overallRisk: this.calculateOverallRisk(fileValidation, securityScan),
        recommendations: this.generateRecommendations(fileValidation, securityScan)
      };

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(
        `File validation failed: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Quick validation for basic file checks
   */
  async quickValidate(filePath: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const fileValidation = await fileValidator.validateFile(filePath);
      return {
        isValid: fileValidation.isValid,
        errors: fileValidation.errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Security-only scan
   */
  async securityScanOnly(filePath: string): Promise<SecurityScanResult> {
    try {
      return await securityScanner.scanFile(filePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(
        `Security scan failed: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Calculate overall risk level based on validation and security results
   */
  private calculateOverallRisk(
    fileValidation: FileValidationResult,
    securityScan: SecurityScanResult
  ): 'low' | 'medium' | 'high' {
    // If file is invalid or unsafe, risk is high
    if (!fileValidation.isValid || !securityScan.isSafe) {
      return 'high';
    }

    // If security scan indicates medium or high risk
    if (securityScan.riskLevel === 'high') {
      return 'high';
    }

    if (securityScan.riskLevel === 'medium') {
      return 'medium';
    }

    // If there are warnings in file validation
    if (fileValidation.warnings.length > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(
    fileValidation: FileValidationResult,
    securityScan: SecurityScanResult
  ): string[] {
    const recommendations: string[] = [];

    // File validation recommendations
    if (!fileValidation.isValid) {
      recommendations.push('File failed validation checks. Please ensure you are uploading a valid ML model file.');
    }

    if (fileValidation.warnings.length > 0) {
      recommendations.push('File validation warnings detected. Please review the file before proceeding.');
    }

    // Security scan recommendations
    if (!securityScan.isSafe) {
      recommendations.push('File failed security scan. This file may contain malicious content.');
    }

    if (securityScan.scanDetails.hasExecutableContent) {
      recommendations.push('File contains executable code. ML model files should not contain executable content.');
    }

    if (securityScan.scanDetails.hasSuspiciousPatterns) {
      recommendations.push('File contains suspicious code patterns. Please verify the source and content of this file.');
    }

    if (securityScan.scanDetails.hasUnexpectedStructure) {
      recommendations.push('File structure is unexpected for the declared format. Please verify file integrity.');
    }

    // General recommendations
    if (securityScan.riskLevel === 'high') {
      recommendations.push('High security risk detected. Do not proceed with this file.');
    } else if (securityScan.riskLevel === 'medium') {
      recommendations.push('Medium security risk detected. Proceed with caution and additional verification.');
    }

    // If no issues found
    if (recommendations.length === 0) {
      recommendations.push('File passed all validation and security checks. Safe to proceed.');
    }

    return recommendations;
  }

  /**
   * Validate file and throw error if validation fails
   */
  async validateOrThrow(filePath: string): Promise<ComprehensiveValidationResult> {
    const result = await this.validateUploadedFile(filePath);

    if (!result.isValid) {
      const errors = result.fileValidation.errors.join(', ');
      throw new AppError(
        `File validation failed: ${errors}`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR
      );
    }

    if (!result.isSafe) {
      const threats = result.securityScan.threats.join(', ');
      throw new AppError(
        `Security scan failed: ${threats}`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.MALICIOUS_CONTENT
      );
    }

    if (result.overallRisk === 'high') {
      throw new AppError(
        'File poses high security risk and cannot be processed',
        HttpStatus.BAD_REQUEST,
        ErrorCode.MALICIOUS_CONTENT
      );
    }

    return result;
  }

  /**
   * Get file checksum
   */
  async getFileChecksum(filePath: string): Promise<string> {
    try {
      return await fileValidator.calculateChecksum(filePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(
        `Failed to calculate file checksum: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Validate file format only
   */
  async validateFormat(filePath: string): Promise<{ format: string | null; isValid: boolean }> {
    try {
      return await fileValidator.validateFileFormat(filePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(
        `Format validation failed: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }
}

// Export singleton instance
export const validationService = new ValidationService();