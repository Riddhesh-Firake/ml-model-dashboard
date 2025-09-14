import swaggerJSDoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ML Model Upload API',
      version: '1.0.0',
      description: 'API for uploading machine learning models and generating inference endpoints',
      contact: {
        name: 'API Support',
        email: 'support@mlapi.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            subscription: {
              type: 'string',
              enum: ['free', 'premium'],
              description: 'User subscription type'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp'
            },
            rateLimits: {
              type: 'object',
              properties: {
                requestsPerMinute: {
                  type: 'number',
                  description: 'Maximum requests per minute'
                },
                modelsLimit: {
                  type: 'number',
                  description: 'Maximum number of models allowed'
                }
              }
            }
          }
        },
        ModelMetadata: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique model identifier'
            },
            name: {
              type: 'string',
              description: 'Model name'
            },
            description: {
              type: 'string',
              description: 'Model description'
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'Owner user ID'
            },
            fileFormat: {
              type: 'string',
              enum: ['pkl', 'joblib', 'h5', 'onnx', 'pt', 'pth'],
              description: 'Model file format'
            },
            endpointUrl: {
              type: 'string',
              format: 'uri',
              description: 'Generated API endpoint URL'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'archived'],
              description: 'Model status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Model creation timestamp'
            },
            lastUsed: {
              type: 'string',
              format: 'date-time',
              description: 'Last usage timestamp'
            },
            requestCount: {
              type: 'number',
              description: 'Total number of prediction requests'
            }
          }
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'API key identifier'
            },
            name: {
              type: 'string',
              description: 'API key name'
            },
            key: {
              type: 'string',
              description: 'API key value (only shown on creation/rotation)'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the API key is active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'API key creation timestamp'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'API key expiration timestamp'
            },
            lastUsed: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Last usage timestamp'
            }
          }
        },
        PredictionRequest: {
          type: 'object',
          description: 'Input data for model prediction',
          additionalProperties: true,
          example: {
            feature1: 1.5,
            feature2: 'category_a',
            feature3: [1, 2, 3]
          }
        },
        PredictionResponse: {
          type: 'object',
          properties: {
            modelId: {
              type: 'string',
              format: 'uuid',
              description: 'Model identifier'
            },
            predictions: {
              description: 'Model prediction results',
              oneOf: [
                { type: 'array' },
                { type: 'object' },
                { type: 'number' },
                { type: 'string' }
              ]
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Prediction confidence score'
            },
            processingTime: {
              type: 'number',
              description: 'Processing time in milliseconds'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp'
            }
          }
        },
        UploadResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Upload success status'
            },
            data: {
              type: 'object',
              properties: {
                modelId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Generated model identifier'
                },
                endpointUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'Generated API endpoint URL'
                },
                fileName: {
                  type: 'string',
                  description: 'Uploaded file name'
                },
                fileSize: {
                  type: 'number',
                  description: 'File size in bytes'
                }
              }
            },
            message: {
              type: 'string',
              description: 'Success message'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code'
                },
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Additional error details'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Error timestamp'
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and profile management'
      },
      {
        name: 'API Keys',
        description: 'API key management'
      },
      {
        name: 'Models',
        description: 'Model management operations'
      },
      {
        name: 'Upload',
        description: 'Model file upload operations'
      },
      {
        name: 'Prediction',
        description: 'Model inference and prediction'
      }
    ]
  },
  apis: [
    './src/api/routes/*.ts',
    './src/services/documentation/swagger-annotations.ts'
  ]
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);