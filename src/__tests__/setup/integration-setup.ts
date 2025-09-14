import { DatabaseManager } from '../../database/database.manager';
import { databaseConfig } from '../../config/database.config';

// Global test setup for integration tests
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Increase timeout for integration tests
  jest.setTimeout(30000);
  
  // Setup test database if needed
  const testConfig = databaseConfig.test;
  if (testConfig) {
    const dbManager = new DatabaseManager(testConfig);
    try {
      await dbManager.initialize();
      await dbManager.close();
    } catch (error) {
      console.warn('Test database setup failed:', error);
    }
  }
});

afterAll(async () => {
  // Global cleanup
  // Close any remaining database connections
  // Clean up temporary files
});

// Mock external services for integration tests
jest.mock('../../services/external/email-service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../../services/external/storage-provider', () => ({
  uploadFile: jest.fn().mockResolvedValue({ url: 'mock-url' }),
  deleteFile: jest.fn().mockResolvedValue({ success: true })
}));

// Suppress console logs during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  if (process.env.SUPPRESS_TEST_LOGS !== 'false') {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterEach(() => {
  if (process.env.SUPPRESS_TEST_LOGS !== 'false') {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
});

// Helper functions for integration tests
export const createTestUser = async (app: any, userData = {}) => {
  const defaultUserData = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123',
    ...userData
  };

  const response = await app
    .post('/api/auth/register')
    .send(defaultUserData);

  return {
    user: response.body.user,
    token: response.body.token,
    email: defaultUserData.email,
    password: defaultUserData.password
  };
};

export const createTestModel = async (app: any, authToken: string, modelData = {}) => {
  const fs = require('fs');
  const path = require('path');
  
  const defaultModelData = {
    name: `Test Model ${Date.now()}`,
    description: 'Test model description',
    content: Buffer.from('mock_model_data'),
    filename: 'test_model.pkl',
    ...modelData
  };

  const tempFilePath = path.join(__dirname, defaultModelData.filename);
  fs.writeFileSync(tempFilePath, defaultModelData.content);

  try {
    const response = await app
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', tempFilePath)
      .field('modelName', defaultModelData.name)
      .field('description', defaultModelData.description);

    return {
      modelId: response.body.modelId,
      endpointUrl: response.body.endpointUrl,
      ...defaultModelData
    };
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
};

export const cleanupTestUser = async (app: any, authToken: string) => {
  try {
    await app
      .delete('/api/auth/user')
      .set('Authorization', `Bearer ${authToken}`);
  } catch (error) {
    console.warn('Failed to cleanup test user:', error);
  }
};

export const cleanupTestModel = async (app: any, authToken: string, modelId: string) => {
  try {
    await app
      .delete(`/api/models/${modelId}`)
      .set('Authorization', `Bearer ${authToken}`);
  } catch (error) {
    console.warn('Failed to cleanup test model:', error);
  }
};

// Test data generators
export const generateTestModelFile = (format: string = 'pkl', size: number = 1024) => {
  const content = Buffer.alloc(size, 'A');
  return {
    content,
    filename: `test_model.${format}`,
    mimetype: getMimeType(format)
  };
};

export const generateMaliciousFile = (type: 'executable' | 'script' | 'oversized') => {
  switch (type) {
    case 'executable':
      return {
        content: Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), // PE header
        filename: 'malicious.exe',
        mimetype: 'application/octet-stream'
      };
    case 'script':
      return {
        content: Buffer.from('<script>alert("xss")</script>'),
        filename: 'malicious.html',
        mimetype: 'text/html'
      };
    case 'oversized':
      return {
        content: Buffer.alloc(100 * 1024 * 1024, 'A'), // 100MB
        filename: 'oversized.pkl',
        mimetype: 'application/octet-stream'
      };
    default:
      throw new Error(`Unknown malicious file type: ${type}`);
  }
};

const getMimeType = (format: string): string => {
  const mimeTypes: Record<string, string> = {
    'pkl': 'application/octet-stream',
    'joblib': 'application/octet-stream',
    'h5': 'application/x-hdf',
    'onnx': 'application/octet-stream',
    'pt': 'application/octet-stream',
    'pth': 'application/octet-stream'
  };
  
  return mimeTypes[format] || 'application/octet-stream';
};

// Performance testing helpers
export const measureResponseTime = async (requestFn: () => Promise<any>) => {
  const startTime = Date.now();
  const response = await requestFn();
  const endTime = Date.now();
  
  return {
    response,
    responseTime: endTime - startTime
  };
};

export const runConcurrentRequests = async (requestFn: () => Promise<any>, count: number) => {
  const requests = Array.from({ length: count }, () => requestFn());
  const startTime = Date.now();
  const responses = await Promise.all(requests);
  const endTime = Date.now();
  
  return {
    responses,
    totalTime: endTime - startTime,
    averageTime: (endTime - startTime) / count
  };
};

// Database helpers for integration tests
export const clearTestDatabase = async () => {
  const testConfig = databaseConfig.test;
  if (!testConfig) return;
  
  const dbManager = new DatabaseManager(testConfig);
  try {
    await dbManager.initialize();
    
    // Clear test data (be careful not to affect production data)
    const connection = dbManager.getConnection();
    await connection.query('DELETE FROM usage_metrics WHERE 1=1');
    await connection.query('DELETE FROM endpoint_configs WHERE 1=1');
    await connection.query('DELETE FROM stored_models WHERE 1=1');
    await connection.query('DELETE FROM models WHERE 1=1');
    await connection.query('DELETE FROM api_keys WHERE 1=1');
    await connection.query('DELETE FROM users WHERE email LIKE "%test%"');
    
    await dbManager.close();
  } catch (error) {
    console.warn('Failed to clear test database:', error);
  }
};

// Export test utilities
export default {
  createTestUser,
  createTestModel,
  cleanupTestUser,
  cleanupTestModel,
  generateTestModelFile,
  generateMaliciousFile,
  measureResponseTime,
  runConcurrentRequests,
  clearTestDatabase
};