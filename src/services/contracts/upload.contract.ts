import { UploadRequest, UploadResponse, FileValidationResult } from '../../models';

export interface IUploadService {
  uploadModel(request: UploadRequest): Promise<UploadResponse>;
  validateFile(file: File): Promise<FileValidationResult>;
  storeFile(file: File, modelId: string): Promise<string>;
  deleteFile(filePath: string): Promise<void>;
  scanForMaliciousContent(filePath: string): Promise<boolean>;
}