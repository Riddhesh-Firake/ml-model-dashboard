// Model-related constants
export const MODEL_FILE_EXTENSIONS = {
  PICKLE: ['.pkl', '.pickle'],
  JOBLIB: ['.joblib'],
  KERAS: ['.h5', '.hdf5'],
  ONNX: ['.onnx'],
  PYTORCH: ['.pt', '.pth']
} as const;

export const SUPPORTED_MIME_TYPES = [
  'application/octet-stream',
  'application/x-pickle',
  'application/x-joblib',
  'application/x-hdf5',
  'application/x-onnx'
] as const;

// File size limits
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  MAX_UPLOAD_SIZE: 500 * 1024 * 1024 // 500MB
} as const;

// Rate limiting defaults
export const DEFAULT_RATE_LIMITS = {
  FREE_TIER: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 1000,
    modelsLimit: 5
  },
  PREMIUM_TIER: {
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    modelsLimit: 50
  }
} as const;

// Model status constants
export enum ModelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

// User subscription types
export enum SubscriptionType {
  FREE = 'free',
  PREMIUM = 'premium'
}

// Error codes
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  MALICIOUS_CONTENT = 'MALICIOUS_CONTENT',
  MODEL_LOAD_ERROR = 'MODEL_LOAD_ERROR',
  PREDICTION_ERROR = 'PREDICTION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  STORAGE_FULL = 'STORAGE_FULL',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// HTTP status codes
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  PAYLOAD_TOO_LARGE = 413,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504
}

// API endpoint patterns
export const API_PATTERNS = {
  MODEL_ENDPOINT: '/api/predict/:modelId',
  UPLOAD_ENDPOINT: '/api/models/upload',
  MODELS_LIST: '/api/models',
  MODEL_DETAILS: '/api/models/:id',
  MODEL_UPDATE: '/api/models/:id',
  MODEL_DELETE: '/api/models/:id',
  USER_REGISTRATION: '/api/auth/register',
  USER_LOGIN: '/api/auth/login',
  ENDPOINT_CONFIG: '/api/endpoints/:modelId'
} as const;

// Validation constants
export const VALIDATION_LIMITS = {
  MODEL_NAME_MIN_LENGTH: 1,
  MODEL_NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
  PASSWORD_MIN_LENGTH: 8,
  API_KEY_LENGTH: 32
} as const;

// Cache settings
export const CACHE_SETTINGS = {
  MODEL_CACHE_TTL: 3600, // 1 hour in seconds
  USER_CACHE_TTL: 1800,  // 30 minutes in seconds
  ENDPOINT_CACHE_TTL: 7200 // 2 hours in seconds
} as const;