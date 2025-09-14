import { ErrorCode, HttpStatus } from './constants';

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    timestamp: string;
  };
}

export class AppError extends Error {
  public readonly statusCode: HttpStatus;
  public readonly code: ErrorCode;
  public readonly details?: any;

  constructor(message: string, statusCode: HttpStatus, code: ErrorCode, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, retryAfter?: number) {
    super(message, HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMIT_EXCEEDED, { retryAfter });
  }
}

export class FileTooLargeError extends AppError {
  constructor(message: string, maxSize?: number) {
    super(message, HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.FILE_TOO_LARGE, { maxSize });
  }
}

export class UnsupportedFormatError extends AppError {
  constructor(message: string, supportedFormats?: string[]) {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.UNSUPPORTED_FORMAT, { supportedFormats });
  }
}

export class MaliciousContentError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.MALICIOUS_CONTENT);
  }
}

export class ModelLoadError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.MODEL_LOAD_ERROR, details);
  }
}

export class PredictionError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.PREDICTION_ERROR, details);
  }
}

export class StorageError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.STORAGE_ERROR, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.DATABASE_ERROR, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.UNAUTHORIZED, ErrorCode.AUTHENTICATION_ERROR, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.FORBIDDEN, ErrorCode.AUTHORIZATION_ERROR, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, HttpStatus.CONFLICT, ErrorCode.CONFLICT_ERROR, details);
  }
}