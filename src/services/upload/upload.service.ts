import { Request, Response, NextFunction } from 'express';
import { fileManagerService, FileUploadResult, FileManagerOptions } from './file-manager.service';
import { tempFileManager } from './temp-file.manager';
import { UploadRequest, UploadResponse } from '../../models/upload.model';
import { AppError } from '../../models/error.model';
import { ErrorCode, HttpStatus } from '../../models/constants';
import { uploadProgressService, UploadProgress } from './upload-progress.service';
import { uploadErrorHandler, UploadErrorContext } from './upload-error-handler.service';
import { randomUUID } from 'crypto';

export class UploadService {
  /**
   * Handle file upload request with progress tracking
   */
  async handleUpload(req: Request): Promise<UploadResponse> {
    const uploadId = randomUUID();
    let progress: UploadProgress | null = null;

    try {
      if (!req.file) {
        throw new AppError(
          'No file uploaded',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
      }

      // Initialize progress tracking
      progress = uploadProgressService.initializeUpload(
        uploadId,
        req.file.originalname,
        req.file.size
      );

      // Extract upload request data
      const uploadRequest: UploadRequest = {
        file: req.file,
        modelName: req.body.modelName,
        description: req.body.description,
        userId: req.body.userId || req.user?.userId // Assuming user is attached to request
      };

      // Validate required fields
      if (!uploadRequest.modelName) {
        throw new AppError(
          'Model name is required',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
      }

      // Update progress to uploading
      uploadProgressService.updateProgress({
        uploadId,
        uploadedSize: req.file.size,
        status: 'processing'
      });

      // Process the uploaded file
      const result = await this.processUpload(uploadRequest, uploadId);

      // Mark upload as completed
      uploadProgressService.completeUpload(uploadId);

      // Generate endpoint URL for the uploaded model
      const endpointUrl = this.generateEndpointUrl(result.modelMetadata.id);

      return {
        modelId: result.modelMetadata.id,
        endpointUrl: endpointUrl,
        status: 'success',
        message: 'Model uploaded successfully',
        uploadId,
        fileInfo: {
          originalName: result.storedModel.originalName,
          size: result.storedModel.fileSize,
          format: result.storedModel.format,
          checksum: result.storedModel.checksum
        },
        validationResult: {
          isValid: result.validationResult.isValid,
          isSafe: result.validationResult.isSafe,
          riskLevel: result.validationResult.overallRisk,
          recommendations: result.validationResult.recommendations
        }
      };

    } catch (error) {
      // Handle error with comprehensive cleanup and user feedback
      const context: UploadErrorContext = {
        uploadId,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        userId: req.user?.userId,
        tempFilePath: req.file?.path,
        stage: 'processing'
      };

      const errorDetails = await uploadErrorHandler.handleUploadError(
        error instanceof Error ? error : new Error('Unknown error'),
        context,
        req
      );

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        errorDetails.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
        errorDetails.code as ErrorCode
      );
    }
  }

  /**
   * Process upload with validation and storage
   */
  private async processUpload(uploadRequest: UploadRequest, uploadId?: string): Promise<FileUploadResult> {
    const options: FileManagerOptions = {
      validateFile: true,
      requireSecurityScan: true,
      encrypt: process.env.NODE_ENV === 'production',
      generateUniqueId: true,
      preserveExtension: true,
      userId: uploadRequest.userId,
      modelName: uploadRequest.modelName,
      description: uploadRequest.description
    };

    return await fileManagerService.processUploadedFile(
      uploadRequest.file.path,
      uploadRequest.file.originalname,
      options
    );
  }

  /**
   * Generate API endpoint URL for the model
   */
  private generateEndpointUrl(modelId: string): string {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/predict/${modelId}`;
  }

  /**
   * Get upload progress
   */
  async getUploadProgress(uploadId: string): Promise<UploadProgress | null> {
    return uploadProgressService.getProgress(uploadId);
  }

  /**
   * Cancel upload
   */
  async cancelUpload(uploadId: string): Promise<UploadProgress | null> {
    const progress = uploadProgressService.getProgress(uploadId);
    if (!progress) {
      throw new AppError(
        'Upload not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND
      );
    }

    if (['completed', 'failed'].includes(progress.status)) {
      throw new AppError(
        `Cannot cancel upload with status: ${progress.status}`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR
      );
    }

    return uploadProgressService.cancelUpload(uploadId);
  }

  /**
   * Validate upload request
   */
  validateUploadRequest(req: Request): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!req.file) {
      errors.push('No file uploaded');
    }

    if (!req.body.modelName || req.body.modelName.trim().length === 0) {
      errors.push('Model name is required');
    }

    if (req.body.modelName && req.body.modelName.length > 255) {
      errors.push('Model name must be less than 255 characters');
    }

    if (req.body.description && req.body.description.length > 1000) {
      errors.push('Description must be less than 1000 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Express middleware for handling uploads
   */
  uploadHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request
      const validation = this.validateUploadRequest(req);
      if (!validation.isValid) {
        throw new AppError(
          `Validation failed: ${validation.errors.join(', ')}`,
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
      }

      // Process upload
      const result = await this.handleUpload(req);

      res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get file by model ID
   */
  async getFile(modelId: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    try {
      const { buffer, model } = await fileManagerService.retrieveFile(modelId);
      
      return {
        buffer,
        filename: model.originalName,
        contentType: this.getContentType(model.format)
      };
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
   * Delete uploaded model
   */
  async deleteModel(modelId: string): Promise<void> {
    try {
      await fileManagerService.deleteFile(modelId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to delete model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Get content type based on model format
   */
  private getContentType(format: string): string {
    const contentTypes: Record<string, string> = {
      'pickle': 'application/octet-stream',
      'joblib': 'application/octet-stream',
      'keras': 'application/x-hdf5',
      'onnx': 'application/x-onnx',
      'pytorch': 'application/octet-stream'
    };

    return contentTypes[format] || 'application/octet-stream';
  }

  /**
   * Get upload statistics
   */
  async getUploadStatistics(): Promise<{
    totalUploads: number;
    totalSize: number;
    averageFileSize: number;
    formatDistribution: Record<string, number>;
  }> {
    try {
      // This would be implemented with database queries
      // For now, return placeholder data
      return {
        totalUploads: 0,
        totalSize: 0,
        averageFileSize: 0,
        formatDistribution: {}
      };
    } catch (error) {
      throw new AppError(
        `Failed to get upload statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.DATABASE_ERROR
      );
    }
  }
}

// Export singleton instance
export const uploadService = new UploadService();