import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { storageConfig } from '../../config/storage.config';

const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Get current environment config
const currentConfig = storageConfig[process.env.NODE_ENV || 'development'];
if (!currentConfig) {
  throw new Error(`Storage configuration not found for environment: ${process.env.NODE_ENV || 'development'}`);
}

export interface TempFileInfo {
  path: string;
  filename: string;
  createdAt: Date;
  size: number;
}

export class TempFileManager {
  private tempDir: string;
  private maxAge: number; // in milliseconds

  constructor(maxAge: number = 24 * 60 * 60 * 1000) { // 24 hours default
    this.tempDir = path.join(currentConfig!.basePath, 'temp');
    this.maxAge = maxAge;
  }

  /**
   * Clean up a specific temporary file
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      console.log(`Cleaned up temp file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to cleanup temp file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Clean up multiple temporary files
   */
  async cleanupFiles(filePaths: string[]): Promise<void> {
    const cleanupPromises = filePaths.map(filePath => this.cleanupFile(filePath));
    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Get information about a temporary file
   */
  async getTempFileInfo(filePath: string): Promise<TempFileInfo | null> {
    try {
      const stats = await stat(filePath);
      return {
        path: filePath,
        filename: path.basename(filePath),
        createdAt: stats.birthtime,
        size: stats.size
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List all temporary files
   */
  async listTempFiles(): Promise<TempFileInfo[]> {
    try {
      const files = await readdir(this.tempDir);
      const tempFiles: TempFileInfo[] = [];

      for (const filename of files) {
        const filePath = path.join(this.tempDir, filename);
        const fileInfo = await this.getTempFileInfo(filePath);
        if (fileInfo) {
          tempFiles.push(fileInfo);
        }
      }

      return tempFiles;
    } catch (error) {
      console.error('Failed to list temp files:', error);
      return [];
    }
  }

  /**
   * Clean up old temporary files based on age
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      const tempFiles = await this.listTempFiles();
      const now = new Date();
      const filesToCleanup: string[] = [];

      for (const file of tempFiles) {
        const age = now.getTime() - file.createdAt.getTime();
        if (age > this.maxAge) {
          filesToCleanup.push(file.path);
        }
      }

      if (filesToCleanup.length > 0) {
        console.log(`Cleaning up ${filesToCleanup.length} old temp files`);
        await this.cleanupFiles(filesToCleanup);
      }
    } catch (error) {
      console.error('Failed to cleanup old temp files:', error);
    }
  }

  /**
   * Schedule periodic cleanup of old temporary files
   */
  startPeriodicCleanup(intervalMs: number = 60 * 60 * 1000): NodeJS.Timeout { // 1 hour default
    return setInterval(() => {
      this.cleanupOldFiles().catch(error => {
        console.error('Periodic temp file cleanup failed:', error);
      });
    }, intervalMs);
  }

  /**
   * Get total size of all temporary files
   */
  async getTotalTempSize(): Promise<number> {
    const tempFiles = await this.listTempFiles();
    return tempFiles.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Check if temp directory has enough space (basic check)
   */
  async hasEnoughSpace(requiredBytes: number): Promise<boolean> {
    try {
      const totalSize = await this.getTotalTempSize();
      const maxTempSize = currentConfig!.maxFileSize * 10; // Allow 10x max file size in temp
      return (totalSize + requiredBytes) <= maxTempSize;
    } catch (error) {
      console.error('Failed to check temp space:', error);
      return false;
    }
  }

  /**
   * Emergency cleanup - remove all temp files
   */
  async emergencyCleanup(): Promise<void> {
    try {
      const tempFiles = await this.listTempFiles();
      const filePaths = tempFiles.map(file => file.path);
      
      if (filePaths.length > 0) {
        console.log(`Emergency cleanup: removing ${filePaths.length} temp files`);
        await this.cleanupFiles(filePaths);
      }
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const tempFileManager = new TempFileManager();

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Cleaning up temp files before shutdown...');
  await tempFileManager.emergencyCleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Cleaning up temp files before shutdown...');
  await tempFileManager.emergencyCleanup();
  process.exit(0);
});