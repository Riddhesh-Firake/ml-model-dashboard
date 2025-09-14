import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { promisify } from 'util';
import { MODEL_FILE_EXTENSIONS, ErrorCode, HttpStatus } from '../../models/constants';
import { AppError } from '../../models/error.model';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

export interface FileValidationResult {
  isValid: boolean;
  format: string | null;
  checksum: string;
  size: number;
  errors: string[];
  warnings: string[];
}

export interface SecurityScanResult {
  isSafe: boolean;
  threats: string[];
  riskLevel: 'low' | 'medium' | 'high';
  scanDetails: {
    hasExecutableContent: boolean;
    hasSuspiciousPatterns: boolean;
    hasUnexpectedStructure: boolean;
  };
}

export class FileValidator {
  private readonly maxFileSize: number;
  private readonly supportedFormats: Record<string, string[]>;

  constructor(maxFileSize: number = 500 * 1024 * 1024) {
    this.maxFileSize = maxFileSize;
    this.supportedFormats = MODEL_FILE_EXTENSIONS as unknown as Record<string, string[]>;
  }

  /**
   * Validate file format based on magic numbers/file signatures
   */
  async validateFileFormat(filePath: string): Promise<{ format: string | null; isValid: boolean }> {
    try {
      const buffer = await readFile(filePath);
      const header = buffer.subarray(0, 16); // Read first 16 bytes for magic number detection

      // Magic number signatures for different file formats
      const signatures = {
        pickle: [0x80, 0x03], // Python pickle protocol 3
        pickle_v2: [0x80, 0x02], // Python pickle protocol 2
        hdf5: [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a], // HDF5 signature
        onnx: [0x08], // ONNX typically starts with protobuf varint
      };

      // Check for HDF5 (used by Keras .h5 files)
      if (this.matchesSignature(header, signatures.hdf5)) {
        return { format: 'keras', isValid: true };
      }

      // Check for pickle files
      if (this.matchesSignature(header, signatures.pickle) || 
          this.matchesSignature(header, signatures.pickle_v2)) {
        return { format: 'pickle', isValid: true };
      }

      // For ONNX files, check if it's a valid protobuf structure
      if (await this.isValidONNX(buffer)) {
        return { format: 'onnx', isValid: true };
      }

      // For PyTorch files, check for torch-specific patterns
      if (await this.isValidPyTorch(buffer)) {
        return { format: 'pytorch', isValid: true };
      }

      // For joblib files, they're typically pickle-based but may have different headers
      if (await this.isValidJoblib(filePath)) {
        return { format: 'joblib', isValid: true };
      }

      return { format: null, isValid: false };
    } catch (error) {
      console.error('File format validation error:', error);
      return { format: null, isValid: false };
    }
  }

  /**
   * Check if byte sequence matches signature
   */
  private matchesSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) return false;
    
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false;
    }
    
    return true;
  }

  /**
   * Validate ONNX file structure
   */
  private async isValidONNX(buffer: Buffer): Promise<boolean> {
    try {
      // ONNX files are protobuf format, check for basic protobuf structure
      // This is a simplified check - in production, you might want to use the ONNX library
      const header = buffer.subarray(0, 100).toString('utf8', 0, 50);
      return header.includes('onnx') || buffer[0] === 0x08; // Basic protobuf varint start
    } catch {
      return false;
    }
  }

  /**
   * Validate PyTorch file structure
   */
  private async isValidPyTorch(buffer: Buffer): Promise<boolean> {
    try {
      // PyTorch files often contain ZIP-like structure or pickle data
      const header = buffer.subarray(0, 10);
      
      // Check for ZIP signature (PyTorch models are often ZIP archives)
      if (header[0] === 0x50 && header[1] === 0x4B) return true;
      
      // Check for pickle signature
      if (header[0] === 0x80 && (header[1] === 0x02 || header[1] === 0x03)) return true;
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Validate joblib file (typically pickle-based)
   */
  private async isValidJoblib(filePath: string): Promise<boolean> {
    try {
      const extension = path.extname(filePath).toLowerCase();
      if (extension !== '.joblib') return false;
      
      const buffer = await readFile(filePath);
      const header = buffer.subarray(0, 10);
      
      // Joblib files are typically pickle format
      return header[0] === 0x80 && (header[1] === 0x02 || header[1] === 0x03);
    } catch {
      return false;
    }
  }

  /**
   * Calculate file checksum
   */
  async calculateChecksum(filePath: string, algorithm: string = 'sha256'): Promise<string> {
    try {
      const buffer = await readFile(filePath);
      const hash = crypto.createHash(algorithm);
      hash.update(buffer);
      return hash.digest('hex');
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
   * Validate file size
   */
  async validateFileSize(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath);
      return stats.size <= this.maxFileSize;
    } catch {
      return false;
    }
  }

  /**
   * Comprehensive file validation
   */
  async validateFile(filePath: string): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      format: null,
      checksum: '',
      size: 0,
      errors: [],
      warnings: []
    };

    try {
      // Check if file exists
      const stats = await stat(filePath);
      result.size = stats.size;

      // Validate file size
      if (!await this.validateFileSize(filePath)) {
        result.errors.push(`File size exceeds maximum limit of ${Math.round(this.maxFileSize / (1024 * 1024))}MB`);
        result.isValid = false;
      }

      // Validate file format
      const formatResult = await this.validateFileFormat(filePath);
      result.format = formatResult.format;
      
      if (!formatResult.isValid) {
        result.errors.push('Unsupported or invalid file format');
        result.isValid = false;
      }

      // Calculate checksum
      result.checksum = await this.calculateChecksum(filePath);

      // Additional validations
      if (result.size === 0) {
        result.errors.push('File is empty');
        result.isValid = false;
      }

      if (result.size < 100) {
        result.warnings.push('File is very small, may not be a valid model');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Validation failed: ${errorMessage}`);
      result.isValid = false;
    }

    return result;
  }
}

export class SecurityScanner {
  private readonly suspiciousPatterns: RegExp[];
  private readonly executableSignatures: Buffer[];

  constructor() {
    // Patterns that might indicate malicious content
    this.suspiciousPatterns = [
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /subprocess/gi,
      /os\.system/gi,
      /shell=True/gi,
      /__import__/gi,
      /compile\s*\(/gi,
      /\.decode\s*\(/gi,
      /base64/gi,
      /urllib/gi,
      /requests/gi,
      /socket/gi,
      /threading/gi,
      /multiprocessing/gi
    ];

    // Common executable file signatures
    this.executableSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable (Windows)
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable (Linux)
      Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O executable (macOS)
      Buffer.from([0xFE, 0xED, 0xFA, 0xCF]), // Mach-O 64-bit executable
    ];
  }

  /**
   * Scan file for security threats
   */
  async scanFile(filePath: string): Promise<SecurityScanResult> {
    const result: SecurityScanResult = {
      isSafe: true,
      threats: [],
      riskLevel: 'low',
      scanDetails: {
        hasExecutableContent: false,
        hasSuspiciousPatterns: false,
        hasUnexpectedStructure: false
      }
    };

    try {
      const buffer = await readFile(filePath);
      
      // Check for executable signatures
      result.scanDetails.hasExecutableContent = this.hasExecutableSignature(buffer);
      if (result.scanDetails.hasExecutableContent) {
        result.threats.push('File contains executable code signatures');
        result.riskLevel = 'high';
        result.isSafe = false;
      }

      // Scan for suspicious patterns in readable content
      const textContent = this.extractTextContent(buffer);
      result.scanDetails.hasSuspiciousPatterns = this.hasSuspiciousPatterns(textContent);
      if (result.scanDetails.hasSuspiciousPatterns) {
        result.threats.push('File contains suspicious code patterns');
        result.riskLevel = result.riskLevel === 'high' ? 'high' : 'medium';
        result.isSafe = false;
      }

      // Check for unexpected file structure
      result.scanDetails.hasUnexpectedStructure = await this.hasUnexpectedStructure(filePath, buffer);
      if (result.scanDetails.hasUnexpectedStructure) {
        result.threats.push('File has unexpected internal structure');
        result.riskLevel = result.riskLevel === 'high' ? 'high' : 'medium';
        result.isSafe = false;
      }

      // Additional entropy check for packed/encrypted content
      const entropy = this.calculateEntropy(buffer);
      if (entropy > 7.5) { // High entropy might indicate packed/encrypted content
        result.threats.push('File has high entropy, possibly packed or encrypted');
        result.riskLevel = 'medium';
        result.isSafe = false;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.threats.push(`Security scan failed: ${errorMessage}`);
      result.riskLevel = 'high';
      result.isSafe = false;
    }

    return result;
  }

  /**
   * Check if buffer contains executable signatures
   */
  private hasExecutableSignature(buffer: Buffer): boolean {
    for (const signature of this.executableSignatures) {
      if (buffer.length >= signature.length) {
        if (buffer.subarray(0, signature.length).equals(signature)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Extract readable text content from buffer
   */
  private extractTextContent(buffer: Buffer): string {
    // Extract ASCII/UTF-8 readable content
    let textContent = '';
    for (let i = 0; i < Math.min(buffer.length, 10000); i++) { // Limit to first 10KB
      const byte = buffer[i];
      if (byte !== undefined && ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13)) {
        textContent += String.fromCharCode(byte);
      }
    }
    return textContent;
  }

  /**
   * Check for suspicious patterns in text content
   */
  private hasSuspiciousPatterns(textContent: string): boolean {
    return this.suspiciousPatterns.some(pattern => pattern.test(textContent));
  }

  /**
   * Check for unexpected file structure
   */
  private async hasUnexpectedStructure(filePath: string, buffer: Buffer): Promise<boolean> {
    const extension = path.extname(filePath).toLowerCase();
    
    // Basic structure validation based on file extension
    switch (extension) {
      case '.pkl':
      case '.pickle':
        return !this.isValidPickleStructure(buffer);
      case '.h5':
        return !this.isValidHDF5Structure(buffer);
      case '.onnx':
        return !this.isValidONNXStructure(buffer);
      default:
        return false;
    }
  }

  /**
   * Validate pickle file structure
   */
  private isValidPickleStructure(buffer: Buffer): boolean {
    // Basic pickle validation - should start with protocol version
    return buffer.length > 2 && buffer[0] === 0x80 && buffer[1] !== undefined && (buffer[1] >= 0x02 && buffer[1] <= 0x05);
  }

  /**
   * Validate HDF5 file structure
   */
  private isValidHDF5Structure(buffer: Buffer): boolean {
    // HDF5 signature validation
    const hdf5Signature = Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]);
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(hdf5Signature);
  }

  /**
   * Validate ONNX file structure
   */
  private isValidONNXStructure(buffer: Buffer): boolean {
    // Basic protobuf structure check
    return buffer.length > 0 && (buffer[0] === 0x08 || buffer[0] === 0x0a);
  }

  /**
   * Calculate Shannon entropy of buffer
   */
  private calculateEntropy(buffer: Buffer): number {
    const frequencies = new Array(256).fill(0);
    
    // Count byte frequencies
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte !== undefined) {
        frequencies[byte]++;
      }
    }
    
    // Calculate entropy
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (frequencies[i] > 0) {
        const probability = frequencies[i] / buffer.length;
        entropy -= probability * Math.log2(probability);
      }
    }
    
    return entropy;
  }
}

// Export singleton instances
export const fileValidator = new FileValidator();
export const securityScanner = new SecurityScanner();