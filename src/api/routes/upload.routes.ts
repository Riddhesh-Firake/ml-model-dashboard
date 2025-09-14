import { Router, Request, Response, NextFunction } from 'express';
import { uploadService } from '../../services/upload/upload.service';
import { uploadMiddleware } from '../../services/upload/upload.middleware';
import { AuthMiddleware } from '../../services/user-management/auth.middleware';
import { AppError } from '../../models/error.model';
import { HttpStatus, ErrorCode } from '../../models/constants';

export class UploadRoutes {
  private router: Router;
  private authMiddleware: AuthMiddleware;

  constructor(authMiddleware: AuthMiddleware) {
    this.router = Router();
    this.authMiddleware = authMiddleware;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // POST /api/models/upload - Upload a new model
    this.router.post(
      '/upload',
      this.authMiddleware.authenticateJWT,
      ...uploadMiddleware,
      this.uploadModel.bind(this)
    );

    // GET /api/models/upload/progress/:uploadId - Get upload progress (future implementation)
    this.router.get(
      '/progress/:uploadId',
      this.authMiddleware.authenticateJWT,
      this.getUploadProgress.bind(this)
    );

    // DELETE /api/models/upload/:uploadId - Cancel upload (future implementation)
    this.router.delete(
      '/cancel/:uploadId',
      this.authMiddleware.authenticateJWT,
      this.cancelUpload.bind(this)
    );

    // GET /api/models/upload/stats - Get upload statistics
    this.router.get(
      '/stats',
      this.authMiddleware.authenticateJWT,
      this.getUploadStats.bind(this)
    );
  }

  /**
   * Upload a new model file
   * POST /api/models/upload
   */
  private async uploadModel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const { modelName, description } = req.body;
      
      if (!modelName || typeof modelName !== 'string' || modelName.trim().length === 0) {
        throw new AppError(
          'Model name is required and must be a non-empty string',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
      }

      if (modelName.length > 255) {
        throw new AppError(
          'Model name must be less than 255 characters',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
      }

      if (description && (typeof description !== 'string' || description.length > 1000)) {
        throw new AppError(
          'Description must be a string with less than 1000 characters',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
      }

      // Add user ID to request body (from authenticated user)
      req.body.userId = req.user?.userId;

      if (!req.body.userId) {
        throw new AppError(
          'User authentication required',
          HttpStatus.UNAUTHORIZED,
          ErrorCode.AUTHENTICATION_ERROR
        );
      }

      // Process the upload
      const result = await uploadService.handleUpload(req);

      res.status(HttpStatus.CREATED).json({
        success: true,
        data: result,
        message: 'Model uploaded successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upload progress for a specific upload
   * GET /api/models/upload/progress/:uploadId
   */
  private async getUploadProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uploadId } = req.params;

      if (!uploadId) {
        throw new AppError(
          'Upload ID is required',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
      }

      const progress = await uploadService.getUploadProgress(uploadId);

      if (!progress) {
        throw new AppError(
          'Upload not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND
        );
      }

      res.json({
        success: true,
        data: {
          uploadId: progress.uploadId,
          fileName: progress.fileName,
          progress: progress.progress,
          status: progress.status,
          uploadedSize: progress.uploadedSize,
          totalSize: progress.totalSize,
          estimatedTimeRemaining: progress.estimatedTimeRemaining,
          error: progress.error
        },
        message: 'Upload progress retrieved successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel an ongoing upload
   * DELETE /api/models/upload/cancel/:uploadId
   */
  private async cancelUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uploadId } = req.params;

      if (!uploadId) {
        throw new AppError(
          'Upload ID is required',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
      }

      const cancelledUpload = await uploadService.cancelUpload(uploadId);

      res.json({
        success: true,
        data: {
          uploadId: cancelledUpload?.uploadId,
          status: cancelledUpload?.status,
          fileName: cancelledUpload?.fileName
        },
        message: 'Upload cancelled successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upload statistics
   * GET /api/models/upload/stats
   */
  private async getUploadStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await uploadService.getUploadStatistics();

      res.json({
        success: true,
        data: stats,
        message: 'Upload statistics retrieved successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}