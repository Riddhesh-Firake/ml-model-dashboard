import { UploadProgressService, UploadProgress } from '../upload-progress.service';

describe('UploadProgressService', () => {
  let service: UploadProgressService;

  beforeEach(() => {
    service = new UploadProgressService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('initializeUpload', () => {
    it('should initialize a new upload progress tracker', () => {
      const uploadId = 'test-upload-id';
      const fileName = 'test-model.pkl';
      const totalSize = 1024;

      const progress = service.initializeUpload(uploadId, fileName, totalSize);

      expect(progress).toEqual({
        uploadId,
        fileName,
        totalSize,
        uploadedSize: 0,
        progress: 0,
        status: 'pending',
        startTime: expect.any(Date)
      });
    });

    it('should emit upload:initialized event', (done) => {
      const uploadId = 'test-upload-id';
      const fileName = 'test-model.pkl';
      const totalSize = 1024;

      service.on('upload:initialized', (progress: UploadProgress) => {
        expect(progress.uploadId).toBe(uploadId);
        expect(progress.fileName).toBe(fileName);
        expect(progress.totalSize).toBe(totalSize);
        done();
      });

      service.initializeUpload(uploadId, fileName, totalSize);
    });
  });

  describe('updateProgress', () => {
    beforeEach(() => {
      service.initializeUpload('test-upload-id', 'test-model.pkl', 1024);
    });

    it('should update upload progress', () => {
      const update = {
        uploadId: 'test-upload-id',
        uploadedSize: 512,
        status: 'uploading' as const
      };

      const progress = service.updateProgress(update);

      expect(progress).toMatchObject({
        uploadId: 'test-upload-id',
        uploadedSize: 512,
        progress: 50,
        status: 'uploading'
      });
    });

    it('should calculate estimated time remaining', () => {
      // Initialize upload and simulate some time passing
      const startTime = Date.now() - 1000; // 1 second ago
      service.initializeUpload('test-upload-id-2', 'test-model.pkl', 1024);
      
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => startTime + 1000);

      const update = {
        uploadId: 'test-upload-id-2',
        uploadedSize: 512,
        status: 'uploading' as const
      };

      const progress = service.updateProgress(update);

      expect(progress?.estimatedTimeRemaining).toBeGreaterThan(0);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should return null for non-existent upload', () => {
      const update = {
        uploadId: 'non-existent',
        uploadedSize: 512
      };

      const progress = service.updateProgress(update);

      expect(progress).toBeNull();
    });

    it('should emit upload:progress event', (done) => {
      service.on('upload:progress', (progress: UploadProgress) => {
        expect(progress.uploadId).toBe('test-upload-id');
        expect(progress.uploadedSize).toBe(512);
        done();
      });

      service.updateProgress({
        uploadId: 'test-upload-id',
        uploadedSize: 512
      });
    });
  });

  describe('completeUpload', () => {
    beforeEach(() => {
      service.initializeUpload('test-upload-id', 'test-model.pkl', 1024);
    });

    it('should mark upload as completed', () => {
      const progress = service.completeUpload('test-upload-id');

      expect(progress).toMatchObject({
        uploadId: 'test-upload-id',
        status: 'completed',
        progress: 100,
        estimatedTimeRemaining: 0
      });
    });

    it('should emit upload:completed event', (done) => {
      service.on('upload:completed', (progress: UploadProgress) => {
        expect(progress.status).toBe('completed');
        done();
      });

      service.completeUpload('test-upload-id');
    });
  });

  describe('failUpload', () => {
    beforeEach(() => {
      service.initializeUpload('test-upload-id', 'test-model.pkl', 1024);
    });

    it('should mark upload as failed with error message', () => {
      const errorMessage = 'Upload failed due to network error';
      const progress = service.failUpload('test-upload-id', errorMessage);

      expect(progress).toMatchObject({
        uploadId: 'test-upload-id',
        status: 'failed',
        error: errorMessage
      });
    });

    it('should emit upload:failed event', (done) => {
      service.on('upload:failed', (progress: UploadProgress) => {
        expect(progress.status).toBe('failed');
        expect(progress.error).toBe('Upload failed');
        done();
      });

      service.failUpload('test-upload-id', 'Upload failed');
    });
  });

  describe('cancelUpload', () => {
    beforeEach(() => {
      service.initializeUpload('test-upload-id', 'test-model.pkl', 1024);
    });

    it('should mark upload as cancelled', () => {
      const progress = service.cancelUpload('test-upload-id');

      expect(progress).toMatchObject({
        uploadId: 'test-upload-id',
        status: 'cancelled'
      });
    });

    it('should emit upload:cancelled event', (done) => {
      service.on('upload:cancelled', (progress: UploadProgress) => {
        expect(progress.status).toBe('cancelled');
        done();
      });

      service.cancelUpload('test-upload-id');
    });
  });

  describe('getProgress', () => {
    it('should return progress for existing upload', () => {
      service.initializeUpload('test-upload-id', 'test-model.pkl', 1024);
      
      const progress = service.getProgress('test-upload-id');

      expect(progress).toMatchObject({
        uploadId: 'test-upload-id',
        fileName: 'test-model.pkl',
        totalSize: 1024
      });
    });

    it('should return null for non-existent upload', () => {
      const progress = service.getProgress('non-existent');

      expect(progress).toBeNull();
    });
  });

  describe('getActiveUploads', () => {
    it('should return only active uploads', () => {
      service.initializeUpload('upload-1', 'model1.pkl', 1024);
      service.initializeUpload('upload-2', 'model2.pkl', 2048);
      service.initializeUpload('upload-3', 'model3.pkl', 512);

      service.completeUpload('upload-1');
      service.failUpload('upload-2', 'Error');

      const activeUploads = service.getActiveUploads();

      expect(activeUploads).toHaveLength(1);
      expect(activeUploads[0]?.uploadId).toBe('upload-3');
    });
  });

  describe('getStatistics', () => {
    it('should return upload statistics', () => {
      service.initializeUpload('upload-1', 'model1.pkl', 1024);
      service.initializeUpload('upload-2', 'model2.pkl', 2048);
      service.initializeUpload('upload-3', 'model3.pkl', 512);

      service.updateProgress({ uploadId: 'upload-1', uploadedSize: 512, status: 'uploading' });
      service.completeUpload('upload-2');
      service.failUpload('upload-3', 'Error');

      const stats = service.getStatistics();

      expect(stats).toEqual({
        total: 3,
        pending: 0,
        uploading: 1,
        processing: 0,
        completed: 1,
        failed: 1,
        cancelled: 0
      });
    });
  });

  describe('removeUpload', () => {
    it('should remove upload from tracking', () => {
      service.initializeUpload('test-upload-id', 'test-model.pkl', 1024);
      
      const removed = service.removeUpload('test-upload-id');
      const progress = service.getProgress('test-upload-id');

      expect(removed).toBe(true);
      expect(progress).toBeNull();
    });

    it('should return false for non-existent upload', () => {
      const removed = service.removeUpload('non-existent');

      expect(removed).toBe(false);
    });
  });
});