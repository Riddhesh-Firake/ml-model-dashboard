import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { app } from '../../app';
import { DatabaseManager } from '../../database/database.manager';
import { databaseConfig } from '../../config/database.config';

describe('Upload to Prediction Integration Tests', () => {
  let testApp: express.Application;
  let dbManager: DatabaseManager;
  let authToken: string;
  let apiKey: string;
  let userId: string;
  let modelId: string;

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

    // Create API key for the user
    const apiKeyResponse = await request(testApp)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test API Key',
        description: 'Integration test key'
      });

    expect(apiKeyResponse.status).toBe(201);
    apiKey = apiKeyResponse.body.key;
  });

  afterEach(async () => {
    // Cleanup test data
    if (modelId) {
      await request(testApp)
        .delete(`/api/models/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }

    // Delete test user
    await request(testApp)
      .delete('/api/auth/user')
      .set('Authorization', `Bearer ${authToken}`);
  });

  describe('Complete Upload to Prediction Workflow', () => {
    it('should complete full workflow: upload model -> get documentation -> make prediction', async () => {
      // Step 1: Create a mock model file
      const mockModelContent = Buffer.from('mock_pickle_model_data');
      const tempFilePath = path.join(__dirname, 'temp_test_model.pkl');
      fs.writeFileSync(tempFilePath, mockModelContent);

      try {
        // Step 2: Upload the model
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'Test Integration Model')
          .field('description', 'Model for integration testing');

        expect(uploadResponse.status).toBe(200);
        expect(uploadResponse.body.success).toBe(true);
        expect(uploadResponse.body.modelId).toBeDefined();
        expect(uploadResponse.body.endpointUrl).toBeDefined();

        modelId = uploadResponse.body.modelId;
        const endpointUrl = uploadResponse.body.endpointUrl;

        // Step 3: Verify model appears in user's model list
        const modelsResponse = await request(testApp)
          .get('/api/models')
          .set('Authorization', `Bearer ${authToken}`);

        expect(modelsResponse.status).toBe(200);
        expect(modelsResponse.body.models).toHaveLength(1);
        expect(modelsResponse.body.models[0].id).toBe(modelId);
        expect(modelsResponse.body.models[0].name).toBe('Test Integration Model');

        // Step 4: Get model documentation
        const docsResponse = await request(testApp)
          .get(`/docs/models/${modelId}/docs`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(docsResponse.status).toBe(200);
        expect(docsResponse.body.documentation).toBeDefined();
        expect(docsResponse.body.documentation.endpointUrl).toContain(modelId);

        // Step 5: Get interactive documentation
        const interactiveDocsResponse = await request(testApp)
          .get(`/docs/models/${modelId}/docs/interactive`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(interactiveDocsResponse.status).toBe(200);
        expect(interactiveDocsResponse.text).toContain('Test Integration Model');
        expect(interactiveDocsResponse.text).toContain('swagger-ui');

        // Step 6: Make a prediction using JWT authentication
        const predictionResponse = await request(testApp)
          .post(`/api/predict/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            input_data: [[1, 2, 3, 4]]
          });

        expect(predictionResponse.status).toBe(200);
        expect(predictionResponse.body.predictions).toBeDefined();
        expect(predictionResponse.body.processingTime).toBeDefined();

        // Step 7: Make a prediction using API key authentication
        const apiKeyPredictionResponse = await request(testApp)
          .post(`/api/predict/${modelId}`)
          .set('X-API-Key', apiKey)
          .send({
            input_data: [[5, 6, 7, 8]]
          });

        expect(apiKeyPredictionResponse.status).toBe(200);
        expect(apiKeyPredictionResponse.body.predictions).toBeDefined();

        // Step 8: Verify usage tracking
        const updatedModelResponse = await request(testApp)
          .get(`/api/models/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(updatedModelResponse.status).toBe(200);
        expect(updatedModelResponse.body.requestCount).toBeGreaterThan(0);

        // Step 9: Update model metadata
        const updateResponse = await request(testApp)
          .put(`/api/models/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Updated Integration Model',
            description: 'Updated description'
          });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.name).toBe('Updated Integration Model');

      } finally {
        // Cleanup temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should handle upload errors gracefully', async () => {
      // Test with invalid file type
      const invalidFilePath = path.join(__dirname, 'invalid_file.txt');
      fs.writeFileSync(invalidFilePath, 'This is not a model file');

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', invalidFilePath)
          .field('modelName', 'Invalid Model')
          .field('description', 'This should fail');

        expect(uploadResponse.status).toBe(400);
        expect(uploadResponse.body.error).toBeDefined();
        expect(uploadResponse.body.error.code).toBe('VALIDATION_ERROR');

      } finally {
        if (fs.existsSync(invalidFilePath)) {
          fs.unlinkSync(invalidFilePath);
        }
      }
    });

    it('should enforce authentication on protected endpoints', async () => {
      // Test upload without authentication
      const uploadResponse = await request(testApp)
        .post('/api/upload')
        .send({});

      expect(uploadResponse.status).toBe(401);

      // Test model list without authentication
      const modelsResponse = await request(testApp)
        .get('/api/models');

      expect(modelsResponse.status).toBe(401);

      // Test prediction without authentication (should fail)
      const predictionResponse = await request(testApp)
        .post('/api/predict/nonexistent-model')
        .send({ input_data: [[1, 2, 3]] });

      expect(predictionResponse.status).toBe(401);
    });

    it('should handle rate limiting', async () => {
      // Create a model first
      const mockModelContent = Buffer.from('mock_model_for_rate_limit_test');
      const tempFilePath = path.join(__dirname, 'rate_limit_test_model.pkl');
      fs.writeFileSync(tempFilePath, mockModelContent);

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'Rate Limit Test Model')
          .field('description', 'Model for rate limit testing');

        expect(uploadResponse.status).toBe(200);
        modelId = uploadResponse.body.modelId;

        // Make multiple rapid requests to trigger rate limiting
        const requests = Array.from({ length: 20 }, () =>
          request(testApp)
            .post(`/api/predict/${modelId}`)
            .set('X-API-Key', apiKey)
            .send({ input_data: [[1, 2, 3]] })
        );

        const responses = await Promise.all(requests);

        // Some requests should be rate limited (429 status)
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        expect(rateLimitedResponses.length).toBeGreaterThan(0);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe('Security and Error Scenarios', () => {
    it('should prevent access to other users models', async () => {
      // Create another user
      const otherUserResponse = await request(testApp)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'otherpassword123'
        });

      const otherAuthToken = otherUserResponse.body.token;

      // Create a model with first user
      const mockModelContent = Buffer.from('mock_model_for_security_test');
      const tempFilePath = path.join(__dirname, 'security_test_model.pkl');
      fs.writeFileSync(tempFilePath, mockModelContent);

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'Security Test Model')
          .field('description', 'Model for security testing');

        expect(uploadResponse.status).toBe(200);
        modelId = uploadResponse.body.modelId;

        // Try to access the model with the other user
        const unauthorizedAccessResponse = await request(testApp)
          .get(`/api/models/${modelId}`)
          .set('Authorization', `Bearer ${otherAuthToken}`);

        expect(unauthorizedAccessResponse.status).toBe(404); // Should not find the model

        // Try to make prediction with other user
        const unauthorizedPredictionResponse = await request(testApp)
          .post(`/api/predict/${modelId}`)
          .set('Authorization', `Bearer ${otherAuthToken}`)
          .send({ input_data: [[1, 2, 3]] });

        expect(unauthorizedPredictionResponse.status).toBe(404);

        // Cleanup other user
        await request(testApp)
          .delete('/api/auth/user')
          .set('Authorization', `Bearer ${otherAuthToken}`);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should handle malformed prediction requests', async () => {
      // Create a model first
      const mockModelContent = Buffer.from('mock_model_for_error_test');
      const tempFilePath = path.join(__dirname, 'error_test_model.pkl');
      fs.writeFileSync(tempFilePath, mockModelContent);

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'Error Test Model')
          .field('description', 'Model for error testing');

        expect(uploadResponse.status).toBe(200);
        modelId = uploadResponse.body.modelId;

        // Test with missing input data
        const missingDataResponse = await request(testApp)
          .post(`/api/predict/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(missingDataResponse.status).toBe(400);
        expect(missingDataResponse.body.error.code).toBe('VALIDATION_ERROR');

        // Test with invalid input format
        const invalidFormatResponse = await request(testApp)
          .post(`/api/predict/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            input_data: 'invalid_format'
          });

        expect(invalidFormatResponse.status).toBe(400);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe('API Documentation Integration', () => {
    it('should provide comprehensive API documentation', async () => {
      // Test main API documentation
      const apiDocsResponse = await request(testApp)
        .get('/docs/api-docs.json');

      expect(apiDocsResponse.status).toBe(200);
      expect(apiDocsResponse.body.openapi).toBeDefined();
      expect(apiDocsResponse.body.paths).toBeDefined();

      // Test health endpoints
      const healthResponse = await request(testApp)
        .get('/monitoring/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBeDefined();

      // Test metrics endpoint
      const metricsResponse = await request(testApp)
        .get('/monitoring/metrics');

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.text).toContain('http_requests_total');
    });
  });
});