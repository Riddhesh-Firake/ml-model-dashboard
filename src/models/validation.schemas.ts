import * as Joi from 'joi';
import { ModelFormat } from './model.model';

// User validation schemas
export const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

export const authenticateUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Model validation schemas
export const createModelSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).required(),
  userId: Joi.string().uuid().required()
});

export const updateModelSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string().valid('active', 'inactive', 'archived').optional()
});

// Upload validation schemas
export const uploadRequestSchema = Joi.object({
  modelName: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).required(),
  userId: Joi.string().uuid().required()
});

// File validation schema
export const fileValidationSchema = Joi.object({
  originalname: Joi.string().required(),
  mimetype: Joi.string().valid(
    'application/octet-stream',
    'application/x-pickle',
    'application/x-joblib',
    'application/x-hdf5',
    'application/x-onnx'
  ).required(),
  size: Joi.number().max(500 * 1024 * 1024).required(), // 500MB max
  buffer: Joi.binary().required()
});

// Prediction validation schemas
export const predictionRequestSchema = Joi.object({
  modelId: Joi.string().uuid().required(),
  inputData: Joi.any().required(),
  apiKey: Joi.string().optional()
});

// Endpoint configuration validation schema
export const endpointConfigSchema = Joi.object({
  id: Joi.string().uuid().required(),
  modelId: Joi.string().uuid().required(),
  url: Joi.string().uri().required(),
  inputSchema: Joi.object({
    type: Joi.string().required(),
    properties: Joi.object().optional(),
    required: Joi.array().items(Joi.string()).optional(),
    additionalProperties: Joi.boolean().optional()
  }).required(),
  outputSchema: Joi.object({
    type: Joi.string().required(),
    properties: Joi.object().optional(),
    required: Joi.array().items(Joi.string()).optional(),
    additionalProperties: Joi.boolean().optional()
  }).required(),
  rateLimits: Joi.object({
    requestsPerMinute: Joi.number().integer().min(1).required(),
    requestsPerHour: Joi.number().integer().min(1).required(),
    requestsPerDay: Joi.number().integer().min(1).required()
  }).required(),
  authRequired: Joi.boolean().required(),
  createdAt: Joi.date().required(),
  updatedAt: Joi.date().required()
});

// Create endpoint configuration validation schema (without id and timestamps)
export const createEndpointConfigSchema = Joi.object({
  modelId: Joi.string().uuid().required(),
  url: Joi.string().uri().required(),
  inputSchema: Joi.object({
    type: Joi.string().required(),
    properties: Joi.object().optional(),
    required: Joi.array().items(Joi.string()).optional(),
    additionalProperties: Joi.boolean().optional()
  }).required(),
  outputSchema: Joi.object({
    type: Joi.string().required(),
    properties: Joi.object().optional(),
    required: Joi.array().items(Joi.string()).optional(),
    additionalProperties: Joi.boolean().optional()
  }).required(),
  rateLimits: Joi.object({
    requestsPerMinute: Joi.number().integer().min(1).required(),
    requestsPerHour: Joi.number().integer().min(1).required(),
    requestsPerDay: Joi.number().integer().min(1).required()
  }).required(),
  authRequired: Joi.boolean().required()
});

// Rate limit configuration validation schema
export const rateLimitConfigSchema = Joi.object({
  requestsPerMinute: Joi.number().integer().min(1).max(1000).required(),
  requestsPerHour: Joi.number().integer().min(1).max(10000).required(),
  requestsPerDay: Joi.number().integer().min(1).max(100000).required()
});

// Model format validation
export const modelFormatSchema = Joi.string().valid(
  ...Object.values(ModelFormat)
);

// Stored model validation schema
export const storedModelSchema = Joi.object({
  id: Joi.string().uuid().required(),
  originalName: Joi.string().required(),
  storagePath: Joi.string().required(),
  fileSize: Joi.number().integer().min(1).required(),
  checksum: Joi.string().required(),
  encryptionKey: Joi.string().required(),
  format: modelFormatSchema.required()
});

// Model metadata validation schema
export const modelMetadataSchema = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).required(),
  userId: Joi.string().uuid().required(),
  fileFormat: Joi.string().required(),
  filePath: Joi.string().required(),
  endpointUrl: Joi.string().uri().required(),
  createdAt: Joi.date().required(),
  lastUsed: Joi.date().required(),
  requestCount: Joi.number().integer().min(0).required(),
  status: Joi.string().valid('active', 'inactive', 'archived').required()
});

// User validation schema
export const userSchema = Joi.object({
  id: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  apiKey: Joi.string().required(),
  createdAt: Joi.date().required(),
  subscription: Joi.string().valid('free', 'premium').required(),
  rateLimits: Joi.object({
    requestsPerMinute: Joi.number().integer().min(1).required(),
    modelsLimit: Joi.number().integer().min(1).required()
  }).required()
});

// API key validation schema
export const apiKeySchema = Joi.string().length(32).alphanum().required();

// UUID validation schema
export const uuidSchema = Joi.string().uuid().required();

// Pagination validation schema
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'name', 'lastUsed', 'requestCount').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Model status update schema
export const modelStatusUpdateSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'archived').required()
});

// Bulk operation schema
export const bulkOperationSchema = Joi.object({
  modelIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
  operation: Joi.string().valid('delete', 'archive', 'activate').required()
});

// API response validation schema
export const apiResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.any().optional(),
  error: Joi.object({
    code: Joi.string().required(),
    message: Joi.string().required(),
    details: Joi.any().optional(),
    timestamp: Joi.string().isoDate().required()
  }).optional(),
  meta: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    total: Joi.number().integer().min(0).optional(),
    totalPages: Joi.number().integer().min(0).optional()
  }).optional()
});

// Health check validation schema
export const healthCheckSchema = Joi.object({
  status: Joi.string().valid('healthy', 'unhealthy').required(),
  timestamp: Joi.string().isoDate().required(),
  services: Joi.object({
    database: Joi.object({
      status: Joi.string().valid('up', 'down').required(),
      responseTime: Joi.number().optional(),
      error: Joi.string().optional()
    }).required(),
    storage: Joi.object({
      status: Joi.string().valid('up', 'down').required(),
      responseTime: Joi.number().optional(),
      error: Joi.string().optional()
    }).required(),
    cache: Joi.object({
      status: Joi.string().valid('up', 'down').required(),
      responseTime: Joi.number().optional(),
      error: Joi.string().optional()
    }).optional()
  }).required()
});