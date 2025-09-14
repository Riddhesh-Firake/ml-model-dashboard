import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { storageService, StorageService } from '../storage.service';
import { AppError } from '../../../models/error.model';
import { ErrorCode, HttpStatus } from '../../../models/constants';

// Mock fs module
jest.mock('fs');
jest.mock('crypto');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('StorageService', () => {
  let service: StorageService;
  const mockBasePath = '/test/storage';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment
    process.env.NODE_ENV = 'test';
    
    // Mock fs.existsSync to return true for base directories
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock fs.mkdirSync
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    
    service = new StorageService();
  });

  describe('storeFile', () => {
    const mockTempFilePath = '/tmp/test-file.pkl';
    const mockOriginalName = 'model.pkl';
    const mockFileBuffer = Buffer.from('test file content');

    beforeEach(() => {
      // Mock promisified fs functions
      (fs.promises.readFile as jest.Mock) = jest.fn().mockResolvedValue(mockFileBuffer);
      (fs.promises.writeFile as jest.Mock) = jest.fn().mockResolvedValue(undefined);
      (fs.promises.unlink as jest.Mock) = jest.fn().mockResolvedValue(undefined);
      (fs.promises.mkdir as jest.Mock) = jest.fn().mockResolvedValue(undefined);
      
      // Mock crypto functions
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mock-checksum')
      };
      (crypto.createHash as jest.Mock).mockReturnValue(mockHash);
      (crypto.randomBytes as jest.Mock).mockReturnValue(Buffer.from('mock-key'));
    });

    it('should successfully store a file without encryption', async () => {
      const options = { encrypt: false };

      const result = await service.storeFile(mockTempFilePath, mockOriginalName, options);

      expect(fs.promises.readFile).toHaveBeenCalledWith(mockTempFilePath);
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(fs.promises.unlink).toHaveBeenCalledWith(mockTempFilePath);
      expect(result.originalName).toBe(mockOriginalName);
      expect(result.checksum).toBe('mock-checksum');
      expect(result.size).toBe(mockFileBuffer.length);
      expect(result.encryptionKey).toBeUndefined();
    });

    it('should successfully store a file with encryption', async () => {
      const options = { encrypt: true };
      
      // Mock cipher for encryption
      const mockCipher = {
        update: jest.fn().mockReturnValue(Buffer.from('encrypted-part1')),
        final: jest.fn().mockReturnValue(Buffer.from('encrypted-part2')),
        setAAD: jest.fn(),
        getAuthTag: jest.fn().mockReturnValue(Buffer.from('auth-tag'))
      };
      (crypto.createCipher as jest.Mock).mockReturnValue(mockCipher);

      const result = await service.storeFile(mockTempFilePath, mockOriginalName, options);

      expect(result.encryptionKey).toBeDefined();
      expect(crypto.randomBytes).toHaveBeenCalledWith(32); // 256-bit key
      expect(crypto.randomBytes).toHaveBeenCalledWith(16); // 128-bit IV
    });

    it('should handle custom storage path', async () => {
      const options = { customPath: 'custom/path' };

      await service.storeFile(mockTempFilePath, mockOriginalName, options);

      expect(fs.promises.mkdir).toHaveBeenCalled();
    });

    it('should throw error when file read fails', async () => {
      (fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('Read failed'));

      await expect(
        service.storeFile(mockTempFilePath, mockOriginalName)
      ).rejects.toThrow(AppError);
    });

    it('should cleanup temp file on error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

      await expect(
        service.storeFile(mockTempFilePath, mockOriginalName)
      ).rejects.toThrow(AppError);

      // Should still attempt cleanup even on error
      expect(fs.promises.unlink).toHaveBeenCalledWith(mockTempFilePath);
    });
  });

  describe('retrieveFile', () => {
    const mockStoragePath = '/storage/models/test-file.pkl';
    const mockFileBuffer = Buffer.from('file content');

    beforeEach(() => {
      (fs.promises.stat as jest.Mock) = jest.fn().mockResolvedValue({ size: 1024 });
      (fs.promises.readFile as jest.Mock) = jest.fn().mockResolvedValue(mockFileBuffer);
    });

    it('should successfully retrieve a file without decryption', async () => {
      const result = await service.retrieveFile(mockStoragePath);

      expect(fs.promises.stat).toHaveBeenCalledWith(mockStoragePath);
      expect(fs.promises.readFile).toHaveBeenCalledWith(mockStoragePath);
      expect(result).toEqual(mockFileBuffer);
    });

    it('should successfully retrieve and decrypt a file', async () => {
      const mockEncryptionKey = 'mock-encryption-key';
      const mockEncryptedBuffer = Buffer.concat([
        Buffer.from('0123456789abcdef'), // IV (16 bytes)
        Buffer.from('fedcba9876543210'), // Auth tag (16 bytes)
        Buffer.from('encrypted-content')  // Encrypted data
      ]);
      
      (fs.promises.readFile as jest.Mock).mockResolvedValue(mockEncryptedBuffer);
      
      // Mock decipher for decryption
      const mockDecipher = {
        update: jest.fn().mockReturnValue(Buffer.from('decrypted-part1')),
        final: jest.fn().mockReturnValue(Buffer.from('decrypted-part2')),
        setAAD: jest.fn(),
        setAuthTag: jest.fn()
      };
      (crypto.createDecipher as jest.Mock).mockReturnValue(mockDecipher);

      const result = await service.retrieveFile(mockStoragePath, mockEncryptionKey);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should throw error when file does not exist', async () => {
      (fs.promises.stat as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(service.retrieveFile(mockStoragePath)).rejects.toThrow(
        new AppError('File not found in storage', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND)
      );
    });
  });

  describe('deleteFile', () => {
    const mockStoragePath = '/storage/models/test-file.pkl';

    it('should successfully delete an existing file', async () => {
      (fs.promises.stat as jest.Mock) = jest.fn().mockResolvedValue({ size: 1024 });
      (fs.promises.unlink as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      await service.deleteFile(mockStoragePath);

      expect(fs.promises.unlink).toHaveBeenCalledWith(mockStoragePath);
    });

    it('should not throw error when file does not exist', async () => {
      (fs.promises.stat as jest.Mock) = jest.fn().mockRejectedValue(new Error('File not found'));

      await expect(service.deleteFile(mockStoragePath)).resolves.not.toThrow();
    });

    it('should throw error when deletion fails', async () => {
      (fs.promises.stat as jest.Mock) = jest.fn().mockResolvedValue({ size: 1024 });
      (fs.promises.unlink as jest.Mock) = jest.fn().mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteFile(mockStoragePath)).rejects.toThrow(AppError);
    });
  });

  describe('moveFile', () => {
    const mockSourcePath = '/tmp/source.pkl';
    const mockDestinationPath = '/storage/models/destination.pkl';

    it('should successfully move a file', async () => {
      (fs.promises.mkdir as jest.Mock) = jest.fn().mockResolvedValue(undefined);
      (fs.promises.copyFile as jest.Mock) = jest.fn().mockResolvedValue(undefined);
      (fs.promises.unlink as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      await service.moveFile(mockSourcePath, mockDestinationPath);

      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.copyFile).toHaveBeenCalledWith(mockSourcePath, mockDestinationPath);
      expect(fs.promises.unlink).toHaveBeenCalledWith(mockSourcePath);
    });

    it('should throw error when move fails', async () => {
      (fs.promises.copyFile as jest.Mock) = jest.fn().mockRejectedValue(new Error('Copy failed'));

      await expect(service.moveFile(mockSourcePath, mockDestinationPath)).rejects.toThrow(AppError);
    });
  });

  describe('getFileInfo', () => {
    const mockStoragePath = '/storage/models/test-file.pkl';

    it('should return file information', async () => {
      const mockStats = {
        size: 1024,
        birthtime: new Date('2023-01-01'),
        mtime: new Date('2023-01-02')
      };
      (fs.promises.stat as jest.Mock) = jest.fn().mockResolvedValue(mockStats);

      const result = await service.getFileInfo(mockStoragePath);

      expect(fs.promises.stat).toHaveBeenCalledWith(mockStoragePath);
      expect(result).toEqual({
        size: mockStats.size,
        createdAt: mockStats.birthtime,
        modifiedAt: mockStats.mtime
      });
    });

    it('should throw error when stat fails', async () => {
      (fs.promises.stat as jest.Mock) = jest.fn().mockRejectedValue(new Error('Stat failed'));

      await expect(service.getFileInfo(mockStoragePath)).rejects.toThrow(AppError);
    });
  });

  describe('verifyFileIntegrity', () => {
    const mockStoragePath = '/storage/models/test-file.pkl';
    const mockExpectedChecksum = 'expected-checksum';

    it('should return true for matching checksums', async () => {
      const mockFileBuffer = Buffer.from('file content');
      (fs.promises.readFile as jest.Mock) = jest.fn().mockResolvedValue(mockFileBuffer);
      
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockExpectedChecksum)
      };
      (crypto.createHash as jest.Mock).mockReturnValue(mockHash);

      const result = await service.verifyFileIntegrity(mockStoragePath, mockExpectedChecksum);

      expect(result).toBe(true);
    });

    it('should return false for non-matching checksums', async () => {
      const mockFileBuffer = Buffer.from('file content');
      (fs.promises.readFile as jest.Mock) = jest.fn().mockResolvedValue(mockFileBuffer);
      
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('different-checksum')
      };
      (crypto.createHash as jest.Mock).mockReturnValue(mockHash);

      const result = await service.verifyFileIntegrity(mockStoragePath, mockExpectedChecksum);

      expect(result).toBe(false);
    });

    it('should return false when file read fails', async () => {
      (fs.promises.readFile as jest.Mock) = jest.fn().mockRejectedValue(new Error('Read failed'));

      const result = await service.verifyFileIntegrity(mockStoragePath, mockExpectedChecksum);

      expect(result).toBe(false);
    });
  });

  describe('generateUniqueFilePath', () => {
    it('should generate unique file path with extension', () => {
      const mockOriginalName = 'model.pkl';
      
      const result = service.generateUniqueFilePath(mockOriginalName);

      expect(result).toContain('.pkl');
      expect(result).toContain('models');
    });

    it('should generate unique file path with custom directory', () => {
      const mockOriginalName = 'model.pkl';
      const customDir = 'custom';
      
      const result = service.generateUniqueFilePath(mockOriginalName, customDir);

      expect(result).toContain('.pkl');
      expect(result).toContain('custom');
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const result = await service.getStorageStats();

      expect(result).toHaveProperty('totalFiles');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('availableSpace');
      expect(typeof result.totalFiles).toBe('number');
      expect(typeof result.totalSize).toBe('number');
      expect(typeof result.availableSpace).toBe('number');
    });
  });
});