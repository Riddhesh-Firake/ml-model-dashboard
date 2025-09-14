import fs from 'fs';
import path from 'path';
import { fileValidator, securityScanner } from '../file-validator';

describe('File Validation', () => {
  const testFilesDir = path.join(__dirname, 'test-files');
  const testPickleFile = path.join(testFilesDir, 'test-model.pkl');
  const testInvalidFile = path.join(testFilesDir, 'test-file.txt');
  const testEmptyFile = path.join(testFilesDir, 'empty.pkl');

  beforeAll(() => {
    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create a mock pickle file (with pickle header)
    const pickleHeader = Buffer.from([0x80, 0x03, 0x58, 0x04, 0x00, 0x00, 0x00, 0x74, 0x65, 0x73, 0x74]);
    fs.writeFileSync(testPickleFile, pickleHeader);

    // Create an invalid file
    fs.writeFileSync(testInvalidFile, 'This is not a model file');

    // Create an empty file
    fs.writeFileSync(testEmptyFile, '');
  });

  afterAll(() => {
    // Clean up test files
    [testPickleFile, testInvalidFile, testEmptyFile].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    if (fs.existsSync(testFilesDir)) {
      fs.rmdirSync(testFilesDir);
    }
  });

  describe('File Format Validation', () => {
    it('should validate pickle file format', async () => {
      const result = await fileValidator.validateFileFormat(testPickleFile);
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('pickle');
    });

    it('should reject invalid file format', async () => {
      const result = await fileValidator.validateFileFormat(testInvalidFile);
      expect(result.isValid).toBe(false);
      expect(result.format).toBeNull();
    });
  });

  describe('File Size Validation', () => {
    it('should validate file size within limits', async () => {
      const isValid = await fileValidator.validateFileSize(testPickleFile);
      expect(isValid).toBe(true);
    });
  });

  describe('Checksum Calculation', () => {
    it('should calculate file checksum', async () => {
      const checksum = await fileValidator.calculateChecksum(testPickleFile);
      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBe(64); // SHA-256 produces 64-character hex string
    });
  });

  describe('Comprehensive File Validation', () => {
    it('should validate valid pickle file', async () => {
      const result = await fileValidator.validateFile(testPickleFile);
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('pickle');
      expect(result.checksum).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty file', async () => {
      const result = await fileValidator.validateFile(testEmptyFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });
  });

  describe('Security Scanning', () => {
    it('should scan file for security threats', async () => {
      const result = await securityScanner.scanFile(testPickleFile);
      expect(result).toBeDefined();
      expect(typeof result.isSafe).toBe('boolean');
      expect(result.riskLevel).toMatch(/^(low|medium|high)$/);
    });

    it('should handle text files safely', async () => {
      const result = await securityScanner.scanFile(testInvalidFile);
      expect(result).toBeDefined();
      expect(typeof result.isSafe).toBe('boolean');
    });
  });
});