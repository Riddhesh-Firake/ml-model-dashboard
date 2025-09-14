import { EventEmitter } from 'events';

export interface UploadProgress {
  uploadId: string;
  fileName: string;
  totalSize: number;
  uploadedSize: number;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  estimatedTimeRemaining?: number;
  error?: string;
}

export interface UploadProgressUpdate {
  uploadId: string;
  uploadedSize: number;
  status?: UploadProgress['status'];
  error?: string;
}

/**
 * Service for tracking upload progress
 */
export class UploadProgressService extends EventEmitter {
  private uploads: Map<string, UploadProgress> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    // Clean up completed uploads every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldUploads();
    }, 5 * 60 * 1000);
  }

  /**
   * Initialize a new upload progress tracker
   */
  initializeUpload(uploadId: string, fileName: string, totalSize: number): UploadProgress {
    const progress: UploadProgress = {
      uploadId,
      fileName,
      totalSize,
      uploadedSize: 0,
      progress: 0,
      status: 'pending',
      startTime: new Date()
    };

    this.uploads.set(uploadId, progress);
    this.emit('upload:initialized', progress);
    
    return progress;
  }

  /**
   * Update upload progress
   */
  updateProgress(update: UploadProgressUpdate): UploadProgress | null {
    const progress = this.uploads.get(update.uploadId);
    if (!progress) {
      return null;
    }

    // Update uploaded size
    progress.uploadedSize = update.uploadedSize;
    progress.progress = Math.min(100, (progress.uploadedSize / progress.totalSize) * 100);

    // Update status if provided
    if (update.status) {
      progress.status = update.status;
    }

    // Update error if provided
    if (update.error) {
      progress.error = update.error;
      progress.status = 'failed';
    }

    // Calculate estimated time remaining
    if (progress.status === 'uploading' && progress.uploadedSize > 0) {
      const elapsedTime = Date.now() - progress.startTime.getTime();
      const uploadRate = progress.uploadedSize / elapsedTime; // bytes per ms
      const remainingBytes = progress.totalSize - progress.uploadedSize;
      progress.estimatedTimeRemaining = Math.round(remainingBytes / uploadRate);
    }

    this.uploads.set(update.uploadId, progress);
    this.emit('upload:progress', progress);

    return progress;
  }

  /**
   * Mark upload as completed
   */
  completeUpload(uploadId: string): UploadProgress | null {
    const progress = this.uploads.get(uploadId);
    if (!progress) {
      return null;
    }

    progress.status = 'completed';
    progress.progress = 100;
    progress.uploadedSize = progress.totalSize;
    progress.estimatedTimeRemaining = 0;

    this.uploads.set(uploadId, progress);
    this.emit('upload:completed', progress);

    return progress;
  }

  /**
   * Mark upload as failed
   */
  failUpload(uploadId: string, error: string): UploadProgress | null {
    const progress = this.uploads.get(uploadId);
    if (!progress) {
      return null;
    }

    progress.status = 'failed';
    progress.error = error;

    this.uploads.set(uploadId, progress);
    this.emit('upload:failed', progress);

    return progress;
  }

  /**
   * Cancel an upload
   */
  cancelUpload(uploadId: string): UploadProgress | null {
    const progress = this.uploads.get(uploadId);
    if (!progress) {
      return null;
    }

    progress.status = 'cancelled';
    this.uploads.set(uploadId, progress);
    this.emit('upload:cancelled', progress);

    return progress;
  }

  /**
   * Get upload progress by ID
   */
  getProgress(uploadId: string): UploadProgress | null {
    return this.uploads.get(uploadId) || null;
  }

  /**
   * Get all active uploads
   */
  getActiveUploads(): UploadProgress[] {
    return Array.from(this.uploads.values()).filter(
      upload => !['completed', 'failed', 'cancelled'].includes(upload.status)
    );
  }

  /**
   * Get all uploads for a user (if user tracking is implemented)
   */
  getUserUploads(userId: string): UploadProgress[] {
    // This would require storing userId with each upload
    // For now, return all uploads (in a real implementation, filter by userId)
    return Array.from(this.uploads.values());
  }

  /**
   * Clean up old completed uploads
   */
  private cleanupOldUploads(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [uploadId, progress] of this.uploads.entries()) {
      if (
        ['completed', 'failed', 'cancelled'].includes(progress.status) &&
        progress.startTime.getTime() < cutoffTime
      ) {
        this.uploads.delete(uploadId);
        this.emit('upload:cleaned', { uploadId });
      }
    }
  }

  /**
   * Remove upload from tracking
   */
  removeUpload(uploadId: string): boolean {
    return this.uploads.delete(uploadId);
  }

  /**
   * Get upload statistics
   */
  getStatistics(): {
    total: number;
    pending: number;
    uploading: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const uploads = Array.from(this.uploads.values());
    
    return {
      total: uploads.length,
      pending: uploads.filter(u => u.status === 'pending').length,
      uploading: uploads.filter(u => u.status === 'uploading').length,
      processing: uploads.filter(u => u.status === 'processing').length,
      completed: uploads.filter(u => u.status === 'completed').length,
      failed: uploads.filter(u => u.status === 'failed').length,
      cancelled: uploads.filter(u => u.status === 'cancelled').length
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.uploads.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const uploadProgressService = new UploadProgressService();