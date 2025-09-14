import path from 'path';
import { randomUUID } from 'crypto';
import { storageService, StorageResult, StorageOptions } from './storage.service';
import { validationService, ComprehensiveValidationResult } from './validation.service';
import { tempFileManager } from './temp-file.manager';
import { StoredModelRepository, CreateStoredModelRequest } from '../../database/repositories/stored-model.repository';
import { ModelRepository } from '../../database/repositories/model.repository';
import { StoredModel, ModelFormat, ModelMetadata, CreateModelRequest } from '../../models/model.model';
import { AppError } from '../../models/error.model';
import { ErrorCode, HttpStatus } from '../../models/constants';
import { DatabaseManager } from '../../database/database.manager';
import { databaseConfig } from '../../config/database.config';

export interface FileUploadResult {
  storedModel: StoredModel;
  modelMetadata: ModelMetadata;
  validationResult: ComprehensiveValidationResult;
  storageResult: StorageResult;
}

export interface FileManagerOptions extends StorageOptions {
  validateFile?: boolean;
  requireSecurityScan?: boolean;
  userId?: string;
  modelName?: string;
  description?: string;
}

export class FileManagerService {
  private storedModelRepository: StoredModelRepository;
  private modelRepository: ModelRepository;

  constructor() {
    // Initialize database connection and repository
    const config = databaseConfig[process.env.NODE_ENV || 'development'];
    if (!config) {
      throw new Error(`Database configuration not found for environment: ${process.env.NODE_ENV || 'development'}`);
    }
    const dbManager = new DatabaseManager(config);
    this.storedModelRepository = new StoredModelRepository(dbManager.getConnection());
    this.modelRepository = new ModelRepository(dbManager.getConnection());
  }

  /**
   * Process uploaded file: validate, store, and create database record
   */
  async processUploadedFile(
    tempFilePath: string,
    originalName: string,
    options: FileManagerOptions = {}
  ): Promise<FileUploadResult> {
    const {
      validateFile = true,
      requireSecurityScan = true,
      userId,
      modelName,
      description,
      ...storageOptions
    } = options;

    try {
      let validationResult: ComprehensiveValidationResult | null = null;

      // Validate file if required
      if (validateFile) {
        validationResult = await validationService.validateUploadedFile(tempFilePath);
        
        // Check if file passed validation
        if (!validationResult.isValid) {
          await tempFileManager.cleanupFile(tempFilePath);
          throw new AppError(
            `File validation failed: ${validationResult.fileValidation.errors.join(', ')}`,
            HttpStatus.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR
          );
        }

        // Check security scan if required
        if (requireSecurityScan && !validationResult.isSafe) {
          await tempFileManager.cleanupFile(tempFilePath);
          throw new AppError(
            `Security scan failed: ${validationResult.securityScan.threats.join(', ')}`,
            HttpStatus.BAD_REQUEST,
            ErrorCode.MALICIOUS_CONTENT
          );
        }

        // Check overall risk level
        if (validationResult.overallRisk === 'high') {
          await tempFileManager.cleanupFile(tempFilePath);
          throw new AppError(
            'File poses high security risk and cannot be processed',
            HttpStatus.BAD_REQUEST,
            ErrorCode.MALICIOUS_CONTENT
          );
        }
      }

      // Store file securely
      const storageResult = await storageService.storeFile(
        tempFilePath,
        originalName,
        storageOptions
      );

      // Create database records
      const { storedModel, modelMetadata } = await this.createModelRecords(
        storageResult,
        originalName,
        validationResult,
        { userId, modelName, description }
      );

      return {
        storedModel,
        modelMetadata,
        validationResult: validationResult!,
        storageResult
      };

    } catch (error) {
      // Cleanup temp file on error
      try {
        await tempFileManager.cleanupFile(tempFilePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Retrieve file for download or processing
   */
  async retrieveFile(modelId: string): Promise<{ buffer: Buffer; model: StoredModel }> {
    try {
      const model = await this.storedModelRepository.findById(modelId);
      if (!model) {
        throw new AppError(
          'Model not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND
        );
      }

      const buffer = await storageService.retrieveFile(
        model.storagePath,
        model.encryptionKey
      );

      return { buffer, model };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to retrieve file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Delete file and database record
   */
  async deleteFile(modelId: string): Promise<void> {
    try {
      const model = await this.storedModelRepository.findById(modelId);
      if (!model) {
        throw new AppError(
          'Model not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND
        );
      }

      // Delete file from storage
      await storageService.deleteFile(model.storagePath);

      // Delete database record
      await this.storedModelRepository.delete(modelId);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Verify file integrity
   */
  async verifyFileIntegrity(modelId: string): Promise<boolean> {
    try {
      const model = await this.storedModelRepository.findById(modelId);
      if (!model) {
        return false;
      }

      return await storageService.verifyFileIntegrity(
        model.storagePath,
        model.checksum
      );
    } catch {
      return false;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(modelId: string): Promise<{
    model: StoredModel;
    fileInfo: { size: number; createdAt: Date; modifiedAt: Date };
  }> {
    try {
      const model = await this.storedModelRepository.findById(modelId);
      if (!model) {
        throw new AppError(
          'Model not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND
        );
      }

      const fileInfo = await storageService.getFileInfo(model.storagePath);

      return { model, fileInfo };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * List files for a user
   */
  async listUserFiles(userId: string): Promise<StoredModel[]> {
    try {
      return await this.storedModelRepository.findAll({ userId });
    } catch (error) {
      throw new AppError(
        `Failed to list user files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(
    modelId: string,
    updates: Partial<Pick<StoredModel, 'originalName'>>
  ): Promise<StoredModel> {
    try {
      const updatedModel = await this.storedModelRepository.update(modelId, updates);
      if (!updatedModel) {
        throw new AppError(
          'Model not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND
        );
      }

      return updatedModel;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to update file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  /**
   * Create both stored model and model metadata database records
   */
  private async createModelRecords(
    storageResult: StorageResult,
    originalName: string,
    validationResult: ComprehensiveValidationResult | null,
    metadata: {
      userId?: string;
      modelName?: string;
      description?: string;
    }
  ): Promise<{ storedModel: StoredModel; modelMetadata: ModelMetadata }> {
    const modelId = randomUUID();
    const format = validationResult?.fileValidation.format || 
                  this.inferFormatFromExtension(originalName);

    // Create stored model record (file storage details)
    const storedModel: CreateStoredModelRequest = {
      modelId,
      originalName,
      storagePath: storageResult.storagePath,
      fileSize: storageResult.size,
      checksum: storageResult.checksum,
      encryptionKey: storageResult.encryptionKey || '',
      format: (format as ModelFormat) || ModelFormat.PICKLE
    };

    const createdStoredModel = await this.storedModelRepository.create(storedModel);

    // Generate endpoint URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const endpointUrl = `${baseUrl}/api/predict/${modelId}`;

    // Create model metadata record (API and user-facing details)
    const modelMetadataRequest: CreateModelRequest & { 
      fileFormat: string; 
      filePath: string; 
      endpointUrl: string 
    } = {
      name: metadata.modelName || originalName,
      description: metadata.description || '',
      userId: metadata.userId || '',
      fileFormat: format,
      filePath: storageResult.storagePath,
      endpointUrl
    };

    const createdModelMetadata = await this.modelRepository.create(modelMetadataRequest);

    return {
      storedModel: createdStoredModel,
      modelMetadata: createdModelMetadata
    };
  }

  /**
   * Infer format from file extension
   */
  private inferFormatFromExtension(filename: string): string {
    const extension = path.extname(filename).toLowerCase();
    
    const formatMap: Record<string, string> = {
      '.pkl': 'pickle',
      '.pickle': 'pickle',
      '.joblib': 'joblib',
      '.h5': 'keras',
      '.hdf5': 'keras',
      '.onnx': 'onnx',
      '.pt': 'pytorch',
      '.pth': 'pytorch'
    };

    return formatMap[extension] || 'unknown';
  }

  /**
   * Cleanup orphaned files (files in storage but not in database)
   */
  async cleanupOrphanedFiles(): Promise<void> {
    try {
      // This would require implementing storage scanning
      // For now, just log that cleanup was requested
      console.log('Orphaned file cleanup requested - implementation depends on storage provider');
    } catch (error) {
      console.error('Failed to cleanup orphaned files:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    availableSpace: number;
  }> {
    try {
      return await storageService.getStorageStats();
    } catch (error) {
      throw new AppError(
        `Failed to get storage statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }
}

// Export singleton instance
export const fileManagerService = new FileManagerService();