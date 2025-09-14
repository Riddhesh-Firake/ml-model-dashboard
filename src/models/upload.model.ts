export interface UploadRequest {
  file: Express.Multer.File;
  modelName: string;
  description: string;
  userId: string;
}

export interface UploadResponse {
  modelId: string;
  endpointUrl: string;
  status: 'success' | 'error';
  message: string;
  uploadId?: string;
  fileInfo?: {
    originalName: string;
    size: number;
    format: string;
    checksum: string;
  };
  validationResult?: {
    isValid: boolean;
    isSafe: boolean;
    riskLevel: string;
    recommendations: string[];
  };
}

export interface FileValidationResult {
  isValid: boolean;
  format?: string;
  errors?: string[];
  fileSize?: number;
  checksum?: string;
}