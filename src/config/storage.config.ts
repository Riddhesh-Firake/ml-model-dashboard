export interface StorageConfig {
  provider: 'local' | 's3' | 'gcs';
  basePath: string;
  maxFileSize: number; // in bytes
  allowedFormats: string[];
  encryptionEnabled: boolean;
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  gcs?: {
    bucket: string;
    projectId: string;
    keyFilename: string;
  };
}

export const storageConfig: Record<string, StorageConfig> = {
  development: {
    provider: 'local',
    basePath: './uploads',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedFormats: ['pkl', 'joblib', 'h5', 'onnx', 'pt', 'pth'],
    encryptionEnabled: false,
  },
  test: {
    provider: 'local',
    basePath: './test-uploads',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFormats: ['pkl', 'joblib', 'h5', 'onnx', 'pt', 'pth'],
    encryptionEnabled: false,
  },
  production: {
    provider: process.env.STORAGE_PROVIDER as 'local' | 's3' | 'gcs' || 'local',
    basePath: process.env.STORAGE_BASE_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '500') * 1024 * 1024, // 500MB default
    allowedFormats: ['pkl', 'joblib', 'h5', 'onnx', 'pt', 'pth'],
    encryptionEnabled: true,
    s3: process.env.STORAGE_PROVIDER === 's3' ? {
      bucket: process.env.S3_BUCKET!,
      region: process.env.S3_REGION!,
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    } : undefined,
    gcs: process.env.STORAGE_PROVIDER === 'gcs' ? {
      bucket: process.env.GCS_BUCKET!,
      projectId: process.env.GCS_PROJECT_ID!,
      keyFilename: process.env.GCS_KEY_FILENAME!,
    } : undefined,
  },
};