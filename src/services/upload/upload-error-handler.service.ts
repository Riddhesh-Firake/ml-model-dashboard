import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../models/error.model';
import { HttpStatus, ErrorCode } from '../../models/constants';
import { uploadProgressService } from './upload-progress.service';
import { tempFileManager } from './temp-file.manager';

export interface UploadErrorContext {
  uploadId?: string;
  fileName?: string;
  fileSize?: number;
  userId?: string;
  tempFilePath?: string;
  stage: 'validation' | 'upload' | 'processing' | 'storage' | 'database';
}

export interface UploadErrorDetails {
  code: string;
  message: string;
  stage: string;
  timestamp: string;
  context?: any;
  suggestions?: string[];
}

/**
 * Service for handling upload-specific errors with cleanup and user feedback
 */
export class UploadErrorHandlerService {
  
  /**
   * Handle upload errors with appropriate cleanup and user feedback
   */
  async handleUploadError(
    error: Error | AppError,
    context: UploadErrorContext,
    req?: Request
  ): Promise<UploadErrorDetails> {
    console.error(`Upload error in ${context.stage}:`, error);

    // Update progress tracking if uploadId is available
    if (context.uploadId) {
      uploadProgressService.failUpload(context.uploadId, error.message);
    }

    // Cleanup temporary files
    await this.cleanupUploadResources(context, req);

    // Create detailed error response
    const errorDetails = this.createErrorDetails(error, context);

    return errorDetails;
  }

  /**
   * Create detailed error information for user feedback
   */
  private createErrorDetails(error: Error | AppError, context: UploadErrorContext): UploadErrorDetails {
    let code: string;
    let message: string;
    let suggestions: string[] = [];

    if (error instanceof AppError) {
      code = error.code;
      message = error.message;
    } else {
      code = this.mapErrorToCode(error, context);
      message = this.createUserFriendlyMessage(error, context);
    }

    // Add context-specific suggestions
    suggestions = this.generateSuggestions(code, context);

    return {
      code,
      message,
      stage: context.stage,
      timestamp: new Date().toISOString(),
      context: {
        fileName: context.fileName,
        fileSize: context.fileSize,
        stage: context.stage
      },
      suggestions
    };
  }

  /**
   * Map generic errors to specific error codes
   */
  private mapErrorToCode(error: Error, context: UploadErrorContext): string {
    const errorMessage = error.message.toLowerCase();

    // File system errors
    if (errorMessage.includes('enoent')) {
      return ErrorCode.FILE_NOT_FOUND;
    }
    if (errorMessage.includes('eacces') || errorMessage.includes('eperm')) {
      return ErrorCode.PERMISSION_DENIED;
    }
    if (errorMessage.includes('enospc')) {
      return ErrorCode.STORAGE_FULL;
    }

    // Network/timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
      return ErrorCode.TIMEOUT_ERROR;
    }

    // Database errors
    if (context.stage === 'database') {
      return ErrorCode.DATABASE_ERROR;
    }

    // Validation errors
    if (context.stage === 'validation') {
      return ErrorCode.VALIDATION_ERROR;
    }

    // Storage errors
    if (context.stage === 'storage') {
      return ErrorCode.STORAGE_ERROR;
    }

    return ErrorCode.INTERNAL_ERROR;
  }

  /**
   * Create user-friendly error messages
   */
  private createUserFriendlyMessage(error: Error, context: UploadErrorContext): string {
    const errorMessage = error.message.toLowerCase();

    // File system errors
    if (errorMessage.includes('enoent')) {
      return `The uploaded file could not be found. Please try uploading again.`;
    }
    if (errorMessage.includes('eacces') || errorMessage.includes('eperm')) {
      return `Permission denied while processing your file. Please contact support.`;
    }
    if (errorMessage.includes('enospc')) {
      return `Server storage is full. Please try again later or contact support.`;
    }

    // Size/limit errors
    if (errorMessage.includes('file too large') || errorMessage.includes('limit')) {
      return `Your file is too large. Please ensure it's under the size limit and try again.`;
    }

    // Format errors
    if (errorMessage.includes('format') || errorMessage.includes('invalid')) {
      return `The file format is not supported or the file is corrupted. Please check your file and try again.`;
    }

    // Network/timeout errors
    if (errorMessage.includes('timeout')) {
      return `The upload timed out. Please check your connection and try again.`;
    }

    // Database errors
    if (context.stage === 'database') {
      return `There was an issue saving your model information. Please try again.`;
    }

    // Generic message based on stage
    switch (context.stage) {
      case 'validation':
        return `Your file failed validation. Please ensure it's a valid ML model file.`;
      case 'upload':
        return `There was an issue uploading your file. Please try again.`;
      case 'processing':
        return `There was an issue processing your file. Please ensure it's a valid model file.`;
      case 'storage':
        return `There was an issue storing your file. Please try again.`;
      default:
        return `An unexpected error occurred while processing your upload. Please try again.`;
    }
  }

  /**
   * Generate helpful suggestions based on error type
   */
  private generateSuggestions(code: string, context: UploadErrorContext): string[] {
    const suggestions: string[] = [];

    switch (code) {
      case ErrorCode.FILE_TOO_LARGE:
        suggestions.push('Compress your model file if possible');
        suggestions.push('Use a more efficient model format (e.g., ONNX)');
        suggestions.push('Consider model quantization to reduce file size');
        break;

      case ErrorCode.UNSUPPORTED_FORMAT:
        suggestions.push('Ensure your file has a supported extension (.pkl, .joblib, .h5, .onnx, .pt, .pth)');
        suggestions.push('Convert your model to a supported format');
        suggestions.push('Check that your file is not corrupted');
        break;

      case ErrorCode.VALIDATION_ERROR:
        suggestions.push('Verify your model file is not corrupted');
        suggestions.push('Ensure the model was saved properly');
        suggestions.push('Try re-exporting your model');
        break;

      case ErrorCode.TIMEOUT_ERROR:
        suggestions.push('Check your internet connection');
        suggestions.push('Try uploading during off-peak hours');
        suggestions.push('Consider compressing your model file');
        break;

      case ErrorCode.STORAGE_FULL:
        suggestions.push('Try again later when storage space is available');
        suggestions.push('Contact support if the issue persists');
        break;

      case ErrorCode.PERMISSION_DENIED:
        suggestions.push('Contact support for assistance');
        break;

      default:
        suggestions.push('Try uploading again');
        suggestions.push('Check your file format and size');
        suggestions.push('Contact support if the issue persists');
    }

    return suggestions;
  }

  /**
   * Cleanup upload resources after an error
   */
  private async cleanupUploadResources(context: UploadErrorContext, req?: Request): Promise<void> {
    const cleanupTasks: Promise<void>[] = [];

    // Cleanup temporary file
    if (context.tempFilePath) {
      cleanupTasks.push(
        tempFileManager.cleanupFile(context.tempFilePath).catch(err => {
          console.error('Failed to cleanup temp file:', err);
        })
      );
    }

    // Cleanup multer temp file if available
    if (req?.file?.path) {
      cleanupTasks.push(
        tempFileManager.cleanupFile(req.file.path).catch(err => {
          console.error('Failed to cleanup multer temp file:', err);
        })
      );
    }

    // Remove from progress tracking
    if (context.uploadId) {
      uploadProgressService.removeUpload(context.uploadId);
    }

    // Wait for all cleanup tasks to complete
    await Promise.allSettled(cleanupTasks);
  }

  /**
   * Express middleware for handling upload errors
   */
  uploadErrorMiddleware = async (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Only handle upload-related errors
    if (!req.path.includes('/upload') && !req.file) {
      return next(error);
    }

    const context: UploadErrorContext = {
      uploadId: req.body.uploadId,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      userId: req.user?.userId,
      tempFilePath: req.file?.path,
      stage: this.determineErrorStage(error, req)
    };

    try {
      const errorDetails = await this.handleUploadError(error, context, req);
      
      const statusCode = error instanceof AppError ? error.statusCode : HttpStatus.INTERNAL_SERVER_ERROR;
      
      res.status(statusCode).json({
        success: false,
        error: errorDetails,
        message: errorDetails.message
      });
    } catch (handlingError) {
      console.error('Error in upload error handler:', handlingError);
      
      // Fallback error response
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
          stage: 'error_handling',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * Determine the stage where the error occurred
   */
  private determineErrorStage(error: any, req: Request): UploadErrorContext['stage'] {
    if (error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT') {
      return 'upload';
    }
    
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.VALIDATION_ERROR:
        case ErrorCode.UNSUPPORTED_FORMAT:
          return 'validation';
        case ErrorCode.STORAGE_ERROR:
        case ErrorCode.STORAGE_FULL:
          return 'storage';
        case ErrorCode.DATABASE_ERROR:
          return 'database';
        default:
          return 'processing';
      }
    }

    // Try to infer from request path or other context
    if (req.path.includes('validate')) {
      return 'validation';
    }

    return 'processing';
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByStage: Record<string, number>;
    errorsByCode: Record<string, number>;
    recentErrors: Array<{ timestamp: string; stage: string; code: string }>;
  } {
    // This would be implemented with proper error tracking/logging
    // For now, return placeholder data
    return {
      totalErrors: 0,
      errorsByStage: {},
      errorsByCode: {},
      recentErrors: []
    };
  }
}

// Export singleton instance
export const uploadErrorHandler = new UploadErrorHandlerService();