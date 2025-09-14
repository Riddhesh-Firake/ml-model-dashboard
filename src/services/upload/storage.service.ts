import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { storageConfig } from '../../config/storage.config';
import { AppError } from '../../models/error.model';
import { ErrorCode, HttpStatus } from '../../models/constants';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);
const copyFile = promisify(fs.copyFile);

// Get current environment config
const currentConfig = storageConfig[process.env.NODE_ENV || 'development'];

export interface StorageResult {
  fileId: string;
  storagePath: string;
  encryptionKey?: string;
  checksum: string;
  size: number;
  originalName: string;
}

export interface StorageOptions {
  encrypt?: boolean;
  generateUniqueId?: boolean;
  preserveExtension?: boolean;
  customPath?: string;
}

export class StorageService {
  private readonly basePath: string;
  private readonly encryptionEnabled: boolean;
  private readonly algorithm: string = 'aes-256-gcm';

  constructor() {
    this.basePath = currentConfig.basePath;
    this.encryptionEnabled = currentConfig.encryptionEnabled;
    this.ensureStorageDirectories();
  }

  /**
   * Store file securely with optional encryption
   */
  async storeFile(
    tempFilePath: string,
    originalName: string,
    options: StorageOptions = {}
  ): Promise<StorageResult> {
    try {
      const {
        encrypt = this.encryptionEnabled,
        generateUniqueId = true,
        preserveExtension = true,
        customPath
      } = options;

      // Generate unique file ID and storage path
      const fileId = generateUniqueId ? uuidv4() : path.parse(originalName).name;
      const extension = preserveExtension ? path.extname(originalName) : '';
      const fileName = `${fileId}${extension}`;
      
      const storagePath = customPath 
        ? path.join(this.basePath, customPath, fileName)
        : path.join(this.basePath, 'models', fileName);

      // Ensure storage directory exists
      await this.ensureDirectory(path.dirname(storagePath));

      // Read the temporary file
      const fileBuffer = await readFile(tempFilePath);
      const checksum = this.calculateChecksum(fileBuffer);

      let finalBuffer = fileBuffer;
      let encryptionKey: string | undefined;

      // Encrypt file if required
      if (encrypt) {
        const encryptionResult = this.encryptBuffer(fileBuffer);
        finalBuffer = encryptionResult.encryptedData;
        encryptionKey = encryptionResult.key;
      }

      // Write to final storage location
      await writeFile(storagePath, finalBuffer);

      // Clean up temporary file
      await unlink(tempFilePath);

      return {
        fileId,
        storagePath,
        encryptionKey,
        checksum,
        size: fileBuffer.length,
        originalName
      };

    } catch (error) {
      throw new AppError(
        `Failed to store file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Retrieve file with automatic decryption
   */
  async retrieveFile(storagePath: string, encryptionKey?: string): Promise<Buffer> {
    try {
      if (!await this.fileExists(storagePath)) {
        throw new AppError(
          'File not found in storage',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND
        );
      }

      const fileBuffer = await readFile(storagePath);

      // Decrypt if encryption key is provided
      if (encryptionKey) {
        return this.decryptBuffer(fileBuffer, encryptionKey);
      }

      return fileBuffer;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Failed to retrieve file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      if (await this.fileExists(storagePath)) {
        await unlink(storagePath);
      }
    } catch (error) {
      throw new AppError(
        `Failed to delete file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Move file from temporary location to permanent storage
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      await this.ensureDirectory(path.dirname(destinationPath));
      await copyFile(sourcePath, destinationPath);
      await unlink(sourcePath);
    } catch (error) {
      throw new AppError(
        `Failed to move file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(storagePath: string): Promise<{ size: number; createdAt: Date; modifiedAt: Date }> {
    try {
      const stats = await stat(storagePath);
      return {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    } catch (error) {
      throw new AppError(
        `Failed to get file info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Generate unique file path
   */
  generateUniqueFilePath(originalName: string, customDir?: string): string {
    const fileId = uuidv4();
    const extension = path.extname(originalName);
    const fileName = `${fileId}${extension}`;
    
    const directory = customDir || 'models';
    return path.join(this.basePath, directory, fileName);
  }

  /**
   * Verify file integrity using checksum
   */
  async verifyFileIntegrity(storagePath: string, expectedChecksum: string): Promise<boolean> {
    try {
      const fileBuffer = await readFile(storagePath);
      const actualChecksum = this.calculateChecksum(fileBuffer);
      return actualChecksum === expectedChecksum;
    } catch {
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    availableSpace: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to use more sophisticated disk space checking
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        availableSpace: 0
      };

      // Count files and calculate total size (simplified)
      // Implementation would depend on storage provider (local, S3, etc.)
      
      return stats;
    } catch (error) {
      throw new AppError(
        `Failed to get storage stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Encrypt buffer using AES-256-GCM
   */
  private encryptBuffer(buffer: Buffer): { encryptedData: Buffer; key: string } {
    try {
      const key = crypto.randomBytes(32); // 256-bit key
      const iv = crypto.randomBytes(16);   // 128-bit IV
      
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('ml-model-file')); // Additional authenticated data
      
      const encrypted = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
      ]);
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const encryptedData = Buffer.concat([iv, authTag, encrypted]);
      
      return {
        encryptedData,
        key: key.toString('hex')
      };
    } catch (error) {
      throw new AppError(
        `Encryption failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Decrypt buffer using AES-256-GCM
   */
  private decryptBuffer(encryptedBuffer: Buffer, keyHex: string): Buffer {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = encryptedBuffer.slice(0, 16);
      const authTag = encryptedBuffer.slice(16, 32);
      const encrypted = encryptedBuffer.slice(32);
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('ml-model-file'));
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      throw new AppError(
        `Decryption failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Calculate SHA-256 checksum
   */
  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignore error if directory already exists
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Ensure all required storage directories exist
   */
  private ensureStorageDirectories(): void {
    const directories = [
      this.basePath,
      path.join(this.basePath, 'models'),
      path.join(this.basePath, 'temp'),
      path.join(this.basePath, 'backups')
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
}

// Export singleton instance
export const storageService = new StorageService();