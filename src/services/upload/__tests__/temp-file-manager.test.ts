import fs from 'fs';
import path from 'path';
import { TempFileManager } from '../temp-file.manager';

describe('TempFileManager', () => {
  let tempFileManager: TempFileManager;
  const testTempDir = path.join(__dirname, 'test-temp');
  const testFile1 = path.join(testTempDir, 'test1.tmp');
  const testFile2 = path.join(testTempDir, 'test2.tmp');

  beforeAll(() => {
    // Create test temp directory
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
    
    // Create temp file manager with short max age for testing
    tempFileManager = new TempFileManager(1000); // 1 second
    
    // Override temp directory for testing
    (tempFileManager as any).tempDir = testTempDir;
  });

  afterAll(() => {
    // Clean up test files and directory
    [testFile1, testFile2].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    if (fs.existsSync(testTempDir)) {
      fs.rmdirSync(testTempDir);
    }
  });

  beforeEach(() => {
    // Create test files
    fs.writeFileSync(testFile1, 'test content 1');
    fs.writeFileSync(testFile2, 'test content 2');
  });

  afterEach(() => {
    // Clean up test files after each test
    [testFile1, testFile2].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('File Cleanup', () => {
    it('should cleanup a single file', async () => {
      expect(fs.existsSync(testFile1)).toBe(true);
      
      await tempFileManager.cleanupFile(testFile1);
      
      expect(fs.existsSync(testFile1)).toBe(false);
    });

    it('should cleanup multiple files', async () => {
      expect(fs.existsSync(testFile1)).toBe(true);
      expect(fs.existsSync(testFile2)).toBe(true);
      
      await tempFileManager.cleanupFiles([testFile1, testFile2]);
      
      expect(fs.existsSync(testFile1)).toBe(false);
      expect(fs.existsSync(testFile2)).toBe(false);
    });
  });

  describe('File Information', () => {
    it('should get temp file info', async () => {
      const fileInfo = await tempFileManager.getTempFileInfo(testFile1);
      
      expect(fileInfo).toBeDefined();
      expect(fileInfo?.path).toBe(testFile1);
      expect(fileInfo?.filename).toBe('test1.tmp');
      expect(fileInfo?.size).toBeGreaterThan(0);
      expect(fileInfo?.createdAt).toBeDefined();
    });

    it('should return null for non-existent file', async () => {
      const fileInfo = await tempFileManager.getTempFileInfo('non-existent.tmp');
      expect(fileInfo).toBeNull();
    });
  });

  describe('File Listing', () => {
    it('should list temp files', async () => {
      const tempFiles = await tempFileManager.listTempFiles();
      
      expect(tempFiles).toHaveLength(2);
      expect(tempFiles.map(f => f.filename)).toContain('test1.tmp');
      expect(tempFiles.map(f => f.filename)).toContain('test2.tmp');
    });
  });

  describe('Storage Statistics', () => {
    it('should calculate total temp size', async () => {
      const totalSize = await tempFileManager.getTotalTempSize();
      expect(totalSize).toBeGreaterThan(0);
    });

    it('should check if has enough space', async () => {
      const hasSpace = await tempFileManager.hasEnoughSpace(1000);
      expect(typeof hasSpace).toBe('boolean');
    });
  });

  describe('Old File Cleanup', () => {
    it('should cleanup old files', async () => {
      // Wait for files to become "old" (older than 1 second)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(fs.existsSync(testFile1)).toBe(true);
      expect(fs.existsSync(testFile2)).toBe(true);
      
      await tempFileManager.cleanupOldFiles();
      
      expect(fs.existsSync(testFile1)).toBe(false);
      expect(fs.existsSync(testFile2)).toBe(false);
    });
  });
});