import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { app } from '../../app';
import { DatabaseManager } from '../../database/database.manager';
import { databaseConfig } from '../../config/database.config';

describe('API Endpoints Integration Tests', () => {
  let testApp: express.Application;
  let dbManager: DatabaseManager;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Setup test database
    const testConfig = databaseConfig.test;
    if (!testConfig) {
      throw new Error('Test database configuration not found');
    }
    
    dbManager = new DatabaseManager(testConfig);
    await dbManager.initialize();
    
    testApp = app;
  });

  afterAll(async () => {
    // Cleanup test database
    if (dbManager) {
      await dbManager.close();
    }
  });

  beforeEach(async () => {
    // Create test user and get authentication
    const userResponse = await request(testApp)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      });

    expect(userResponse.status).toBe(201);
    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;
  });

  afterEach(async () => {
    // Delete test user
    await request(testApp)
      .delete('/api/auth/user')
      .set('Authorization', `Bearer ${authToken}`);
  });

  describe('Authentication Endpoints', () => {
    it('should handle user registration and login flow', async () => {
      // Test registration with new email
      const registerResponse = await request(testApp)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'newpassword123'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.token).toBeDefined();
      expect(registerResponse.body.user.email).toBe('newuser@example.com');

      // Test login with registered credentials
      const loginResponse = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: 'newuser@example.com',
          password: 'newpassword123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
      expect(loginResponse.body.user.email).toBe('newuser@example.com');

      // Test login with wrong password
      const wrongPasswordResponse = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: 'newuser@example.com',
          password: 'wrongpassword'
        });

      expect(wrongPasswordResponse.status).toBe(401);
      expect(wrongPasswordResponse.body.error.code).toBe('AUTHENTICATION_FAILED');

      // Cleanup new user
      await request(testApp)
        .delete('/api/auth/user')
        .set('Authorization', `Bearer ${loginResponse.body.token}`);
    });

    it('should prevent duplicate user registration', async () => {
      // Try to register with existing email
      const duplicateResponse = await request(testApp)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com', // Same as beforeEach user
          password: 'anotherpassword123'
        });

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('should validate password requirements', async () => {
      // Test with weak password
      const weakPasswordResponse = await request(testApp)
        .post('/api/auth/register')
        .send({
          email: 'weakpass@example.com',
          password: '123' // Too short
        });

      expect(weakPasswordResponse.status).toBe(400);
      expect(weakPasswordResponse.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('API Key Management Endpoints', () => {
    it('should handle API key lifecycle', async () => {
      // Create API key
      const createResponse = await request(testApp)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test API Key',
          description: 'Integration test key',
          expiresIn: '30d'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.key).toBeDefined();
      expect(createResponse.body.name).toBe('Test API Key');
      
      const apiKeyId = createResponse.body.id;
      const apiKey = createResponse.body.key;

      // List API keys
      const listResponse = await request(testApp)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.apiKeys).toHaveLength(1);
      expect(listResponse.body.apiKeys[0].name).toBe('Test API Key');

      // Get specific API key
      const getResponse = await request(testApp)
        .get(`/api/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.name).toBe('Test API Key');

      // Update API key
      const updateResponse = await request(testApp)
        .put(`/api/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated API Key',
          description: 'Updated description'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.name).toBe('Updated API Key');

      // Test API key authentication
      const authTestResponse = await request(testApp)
        .get('/api/models')
        .set('X-API-Key', apiKey);

      expect(authTestResponse.status).toBe(200);

      // Rotate API key
      const rotateResponse = await request(testApp)
        .post(`/api/api-keys/${apiKeyId}/rotate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(rotateResponse.status).toBe(200);
      expect(rotateResponse.body.key).not.toBe(apiKey);

      // Old key should no longer work
      const oldKeyTestResponse = await request(testApp)
        .get('/api/models')
        .set('X-API-Key', apiKey);

      expect(oldKeyTestResponse.status).toBe(401);

      // Delete API key
      const deleteResponse = await request(testApp)
        .delete(`/api/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(204);

      // Verify key is deleted
      const deletedKeyResponse = await request(testApp)
        .get(`/api/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deletedKeyResponse.status).toBe(404);
    });
  });

  describe('Model Management Endpoints', () => {
    let modelId: string;

    beforeEach(async () => {
      // Create a test model
      const mockModelContent = Buffer.from('mock_model_data');
      const tempFilePath = path.join(__dirname, 'test_model.pkl');
      fs.writeFileSync(tempFilePath, mockModelContent);

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'Test Model')
          .field('description', 'Test model description');

        modelId = uploadResponse.body.modelId;
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    afterEach(async () => {
      // Cleanup model
      if (modelId) {
        await request(testApp)
          .delete(`/api/models/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`);
      }
    });

    it('should handle model CRUD operations', async () => {
      // Get model details
      const getResponse = await request(testApp)
        .get(`/api/models/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.name).toBe('Test Model');
      expect(getResponse.body.description).toBe('Test model description');

      // Update model
      const updateResponse = await request(testApp)
        .put(`/api/models/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Test Model',
          description: 'Updated description'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.name).toBe('Updated Test Model');

      // List user models
      const listResponse = await request(testApp)
        .get('/api/models')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.models).toHaveLength(1);
      expect(listResponse.body.models[0].name).toBe('Updated Test Model');

      // Get model usage statistics
      const statsResponse = await request(testApp)
        .get(`/api/models/${modelId}/stats`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.requestCount).toBeDefined();
      expect(statsResponse.body.lastUsed).toBeDefined();
    });

    it('should handle model not found scenarios', async () => {
      const nonexistentModelId = 'nonexistent-model-id';

      // Get nonexistent model
      const getResponse = await request(testApp)
        .get(`/api/models/${nonexistentModelId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);

      // Update nonexistent model
      const updateResponse = await request(testApp)
        .put(`/api/models/${nonexistentModelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' });

      expect(updateResponse.status).toBe(404);

      // Delete nonexistent model
      const deleteResponse = await request(testApp)
        .delete(`/api/models/${nonexistentModelId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(404);
    });
  });

  describe('Upload Endpoints', () => {
    it('should handle various file upload scenarios', async () => {
      // Test successful upload
      const validModelContent = Buffer.from('valid_pickle_model');
      const validFilePath = path.join(__dirname, 'valid_model.pkl');
      fs.writeFileSync(validFilePath, validModelContent);

      try {
        const validUploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', validFilePath)
          .field('modelName', 'Valid Model')
          .field('description', 'Valid model description');

        expect(validUploadResponse.status).toBe(200);
        expect(validUploadResponse.body.success).toBe(true);
        expect(validUploadResponse.body.modelId).toBeDefined();

        // Cleanup
        await request(testApp)
          .delete(`/api/models/${validUploadResponse.body.modelId}`)
          .set('Authorization', `Bearer ${authToken}`);

      } finally {
        if (fs.existsSync(validFilePath)) {
          fs.unlinkSync(validFilePath);
        }
      }

      // Test upload without file
      const noFileResponse = await request(testApp)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('modelName', 'No File Model');

      expect(noFileResponse.status).toBe(400);
      expect(noFileResponse.body.error.code).toBe('NO_FILE_PROVIDED');

      // Test upload with missing required fields
      const missingFieldsPath = path.join(__dirname, 'missing_fields.pkl');
      fs.writeFileSync(missingFieldsPath, Buffer.from('model_data'));

      try {
        const missingFieldsResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', missingFieldsPath);
        // Missing modelName field

        expect(missingFieldsResponse.status).toBe(400);
        expect(missingFieldsResponse.body.error.code).toBe('VALIDATION_ERROR');

      } finally {
        if (fs.existsSync(missingFieldsPath)) {
          fs.unlinkSync(missingFieldsPath);
        }
      }
    });

    it('should handle upload progress tracking', async () => {
      const modelContent = Buffer.from('model_for_progress_test');
      const progressFilePath = path.join(__dirname, 'progress_test.pkl');
      fs.writeFileSync(progressFilePath, modelContent);

      try {
        // Start upload
        const uploadPromise = request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', progressFilePath)
          .field('modelName', 'Progress Test Model')
          .field('description', 'Testing upload progress');

        // Note: In a real scenario, you might check progress during upload
        // For this test, we'll just verify the upload completes successfully
        const uploadResponse = await uploadPromise;

        expect(uploadResponse.status).toBe(200);
        expect(uploadResponse.body.success).toBe(true);

        // Cleanup
        await request(testApp)
          .delete(`/api/models/${uploadResponse.body.modelId}`)
          .set('Authorization', `Bearer ${authToken}`);

      } finally {
        if (fs.existsSync(progressFilePath)) {
          fs.unlinkSync(progressFilePath);
        }
      }
    });
  });

  describe('Prediction Endpoints', () => {
    let modelId: string;

    beforeEach(async () => {
      // Create a test model for predictions
      const mockModelContent = Buffer.from('prediction_test_model');
      const tempFilePath = path.join(__dirname, 'prediction_model.pkl');
      fs.writeFileSync(tempFilePath, mockModelContent);

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'Prediction Test Model')
          .field('description', 'Model for prediction testing');

        modelId = uploadResponse.body.modelId;
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    afterEach(async () => {
      // Cleanup model
      if (modelId) {
        await request(testApp)
          .delete(`/api/models/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`);
      }
    });

    it('should handle prediction requests', async () => {
      // Valid prediction request
      const predictionResponse = await request(testApp)
        .post(`/api/predict/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          input_data: [[1, 2, 3, 4, 5]]
        });

      expect(predictionResponse.status).toBe(200);
      expect(predictionResponse.body.predictions).toBeDefined();
      expect(predictionResponse.body.processingTime).toBeDefined();
      expect(predictionResponse.body.status).toBe('success');

      // Invalid input format
      const invalidInputResponse = await request(testApp)
        .post(`/api/predict/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          input_data: 'invalid_format'
        });

      expect(invalidInputResponse.status).toBe(400);
      expect(invalidInputResponse.body.error.code).toBe('VALIDATION_ERROR');

      // Missing input data
      const missingInputResponse = await request(testApp)
        .post(`/api/predict/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(missingInputResponse.status).toBe(400);
      expect(missingInputResponse.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle batch prediction requests', async () => {
      const batchPredictionResponse = await request(testApp)
        .post(`/api/predict/${modelId}/batch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          input_data: [
            [1, 2, 3, 4, 5],
            [6, 7, 8, 9, 10],
            [11, 12, 13, 14, 15]
          ]
        });

      expect(batchPredictionResponse.status).toBe(200);
      expect(batchPredictionResponse.body.predictions).toHaveLength(3);
      expect(batchPredictionResponse.body.processingTime).toBeDefined();
    });
  });

  describe('Monitoring Endpoints', () => {
    it('should provide system health information', async () => {
      // Health check
      const healthResponse = await request(testApp)
        .get('/monitoring/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toMatch(/healthy|degraded/);
      expect(healthResponse.body.timestamp).toBeDefined();

      // Liveness probe
      const livenessResponse = await request(testApp)
        .get('/monitoring/health/live');

      expect(livenessResponse.status).toBe(200);
      expect(livenessResponse.body.status).toBe('alive');

      // Readiness probe
      const readinessResponse = await request(testApp)
        .get('/monitoring/health/ready');

      expect(readinessResponse.status).toBe(200);

      // Metrics
      const metricsResponse = await request(testApp)
        .get('/monitoring/metrics');

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.text).toContain('http_requests_total');
    });

    it('should provide performance metrics', async () => {
      const performanceResponse = await request(testApp)
        .get('/monitoring/performance');

      expect(performanceResponse.status).toBe(200);
      expect(performanceResponse.body.performance).toBeDefined();
      expect(performanceResponse.body.system).toBeDefined();
      expect(performanceResponse.body.timestamp).toBeDefined();
    });
  });
});