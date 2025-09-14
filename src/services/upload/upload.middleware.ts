import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { storageConfig } from '../../config/storage.config';
import { MODEL_FILE_EXTENSIONS, FILE_SIZE_LIMITS, ErrorCode, HttpStatus } from '../../models/constants';
import { AppError } from '../../models/error.model';

// Get current environment config
const currentConfig = storageConfig[process.env.NODE_ENV || 'development'];
if (!currentConfig) {
  throw new Error(`Storage configuration not found for environment: ${process.env.NODE_ENV || 'development'}`);
}

// Ensure upload directory exists
const ensureUploadDir = (uploadPath: string): void => {
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
};

// Initialize upload directory
ensureUploadDir(currentConfig.basePath);

// File filter function to validate file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Check if file extension is supported
  const supportedExtensions = Object.values(MODEL_FILE_EXTENSIONS).flat();
  const isSupported = supportedExtensions.includes(fileExtension as any);
  
  if (!isSupported) {
    const error = new AppError(
      `Unsupported file format: ${fileExtension}. Supported formats: ${supportedExtensions.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.UNSUPPORTED_FORMAT
    );
    return cb(error);
  }
  
  cb(null, true);
};

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void): void => {
    // Create temporary upload directory
    const tempDir = path.join(currentConfig.basePath, 'temp');
    ensureUploadDir(tempDir);
    cb(null, tempDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void): void => {
    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}-${randomString}${extension}`;
    cb(null, filename);
  }
});

// Configure multer with storage, file filter, and limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: currentConfig.maxFileSize,
    files: 1, // Only allow single file upload
    fields: 10, // Limit number of form fields
    fieldNameSize: 100, // Limit field name size
    fieldSize: 1024 * 1024 // 1MB limit for field values
  }
});

// Middleware to handle single file upload
export const uploadSingleFile = upload.single('modelFile');

// Error handling middleware for multer errors
export const handleUploadErrors = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error && error.name === 'MulterError') {
    let appError: AppError;
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        appError = new AppError(
          `File too large. Maximum size allowed: ${Math.round(currentConfig.maxFileSize / (1024 * 1024))}MB`,
          HttpStatus.PAYLOAD_TOO_LARGE,
          ErrorCode.FILE_TOO_LARGE
        );
        break;
      case 'LIMIT_FILE_COUNT':
        appError = new AppError(
          'Too many files. Only one file is allowed per upload.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        appError = new AppError(
          'Unexpected file field. Use "modelFile" as the field name.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
        break;
      default:
        appError = new AppError(
          `Upload error: ${error.message}`,
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR
        );
    }
    
    return next(appError);
  }
  
  // Handle other upload-related errors
  if (error instanceof AppError) {
    return next(error);
  }
  
  // Handle unexpected errors
  const appError = new AppError(
    'An unexpected error occurred during file upload',
    HttpStatus.INTERNAL_SERVER_ERROR,
    ErrorCode.STORAGE_ERROR
  );
  
  next(appError);
};

// Middleware to validate uploaded file
export const validateUploadedFile = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file) {
    const error = new AppError(
      'No file uploaded. Please select a model file to upload.',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR
    );
    return next(error);
  }
  
  // Additional file validation can be added here
  // For example, checking file content, magic numbers, etc.
  
  next();
};

// Cleanup middleware to remove temporary files on error
export const cleanupTempFile = (req: Request, res: Response, next: NextFunction): void => {
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to cleanup temp file
  res.end = function(chunk?: any, encoding?: any): any {
    // Clean up temp file if it exists and response is not successful
    if (req.file && req.file.path && res.statusCode >= 400) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error('Failed to cleanup temp file:', err);
        }
      });
    }
    
    // Call original end function
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Combined upload middleware that includes all necessary steps
export const uploadMiddleware = [
  cleanupTempFile,
  uploadSingleFile,
  handleUploadErrors,
  validateUploadedFile
];

// Utility function to get file extension from filename
export const getFileExtension = (filename: string): string => {
  return path.extname(filename).toLowerCase();
};

// Utility function to determine model format from file extension
export const getModelFormat = (filename: string): string | null => {
  const extension = getFileExtension(filename);
  
  for (const [format, extensions] of Object.entries(MODEL_FILE_EXTENSIONS)) {
    if ((extensions as readonly string[]).includes(extension)) {
      return format.toLowerCase();
    }
  }
  
  return null;
};

// Utility function to validate file size
export const validateFileSize = (fileSize: number): boolean => {
  return fileSize <= currentConfig.maxFileSize;
};

// Utility function to get supported file extensions
export const getSupportedExtensions = (): string[] => {
  return Object.values(MODEL_FILE_EXTENSIONS).flat();
};