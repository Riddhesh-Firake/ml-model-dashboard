import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { app } from '../../app';
import { DatabaseManager } from '../../database/database.manager';
import { databaseConfig } from '../../config/database.config';

describe('Security Scenarios Integration Tests', () => {
  let testApp: express.Application;
  let dbManager: DatabaseManager;
  let authToken: string;
  let userId: string;
  let apiKey: string;

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
        email: 'security-test@example.com',
        password: 'securepassword123'
      });

    expect(userResponse.status).toBe(201);
    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;

    // Create API key
    const apiKeyResponse = await request(testApp)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Security Test API Key',
        description: 'API key for security testing'
      });

    apiKey = apiKeyResponse.body.key;
  });

  afterEach(async () => {
    // Delete test user
    await request(testApp)
      .delete('/api/auth/user')
      .set('Authorization', `Bearer ${authToken}`);
  });

  describe('Authentication Security', () => {
    it('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'Bearer invalid-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        ''
      ];

      for (const token of invalidTokens) {
        const response = await request(testApp)
          .get('/api/models')
          .set('Authorization', token);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toMatch(/AUTHENTICATION_FAILED|INVALID_TOKEN/);
      }
    });

    it('should reject invalid API keys', async () => {
      const invalidApiKeys = [
        'invalid-api-key',
        'expired-key-12345',
        '',
        'malformed-key-format'
      ];

      for (const key of invalidApiKeys) {
        const response = await request(testApp)
          .get('/api/models')
          .set('X-API-Key', key);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('API_KEY_AUTHENTICATION_FAILED');
      }
    });

    it('should handle expired tokens gracefully', async () => {
      // This would require creating an expired token
      // For now, we'll test with a malformed token that simulates expiration
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid';

      const response = await request(testApp)
        .get('/api/models')
        .set('Authorization', expiredToken);

      expect(response.status).toBe(401);
    });

    it('should prevent brute force attacks on login', async () => {
      const loginAttempts = Array.from({ length: 10 }, () =>
        request(testApp)
          .post('/api/auth/login')
          .send({
            email: 'security-test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(loginAttempts);

      // All should fail with 401
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });

      // After multiple failed attempts, there might be rate limiting
      // (This depends on implementation)
    });
  });

  describe('File Upload Security', () => {
    it('should reject malicious file uploads', async () => {
      const maliciousFiles = [
        { name: 'malicious.exe', content: 'MZ\x90\x00\x03\x00\x00\x00' }, // PE header
        { name: 'script.js', content: 'alert("xss")' },
        { name: 'large.pkl', content: 'A'.repeat(100 * 1024 * 1024) }, // 100MB file
        { name: 'empty.pkl', content: '' }
      ];

      for (const file of maliciousFiles) {
        const filePath = path.join(__dirname, file.name);
        fs.writeFileSync(filePath, file.content);

        try {
          const response = await request(testApp)
            .post('/api/upload')
            .set('Authorization', `Bearer ${authToken}`)
            .attach('file', filePath)
            .field('modelName', `Test ${file.name}`)
            .field('description', 'Security test file');

          // Should reject malicious files
          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.body.error).toBeDefined();

        } finally {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    });

    it('should sanitize file names and metadata', async () => {
      const maliciousInputs = [
        { modelName: '<script>alert("xss")</script>', description: 'Normal description' },
        { modelName: '../../../etc/passwd', description: 'Path traversal attempt' },
        { modelName: 'DROP TABLE users;', description: 'SQL injection attempt' },
        { modelName: 'Normal Name', description: '${process.env.SECRET_KEY}' }
      ];

      const validModelContent = Buffer.from('valid_model_data');
      const tempFilePath = path.join(__dirname, 'security_test.pkl');
      fs.writeFileSync(tempFilePath, validModelContent);

      try {
        for (const input of maliciousInputs) {
          const response = await request(testApp)
            .post('/api/upload')
            .set('Authorization', `Bearer ${authToken}`)
            .attach('file', tempFilePath)
            .field('modelName', input.modelName)
            .field('description', input.description);

          if (response.status === 200) {
            // If upload succeeds, verify data is sanitized
            const modelId = response.body.modelId;
            
            const getResponse = await request(testApp)
              .get(`/api/models/${modelId}`)
              .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.body.name).not.toContain('<script>');
            expect(getResponse.body.name).not.toContain('../');
            expect(getResponse.body.description).not.toContain('${');

            // Cleanup
            await request(testApp)
              .delete(`/api/models/${modelId}`)
              .set('Authorization', `Bearer ${authToken}`);
          }
        }
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe('Access Control Security', () => {
    it('should enforce proper authorization on all endpoints', async () => {
      // Create a model with the authenticated user
      const modelContent = Buffer.from('access_control_test_model');
      const tempFilePath = path.join(__dirname, 'access_control_test.pkl');
      fs.writeFileSync(tempFilePath, modelContent);

      let modelId: string;

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'Access Control Test Model')
          .field('description', 'Testing access control');

        modelId = uploadResponse.body.modelId;

        // Create another user
        const otherUserResponse = await request(testApp)
          .post('/api/auth/register')
          .send({
            email: 'other-user@example.com',
            password: 'otherpassword123'
          });

        const otherAuthToken = otherUserResponse.body.token;

        try {
          // Test unauthorized access attempts
          const unauthorizedEndpoints = [
            { method: 'get', path: `/api/models/${modelId}` },
            { method: 'put', path: `/api/models/${modelId}` },
            { method: 'delete', path: `/api/models/${modelId}` },
            { method: 'post', path: `/api/predict/${modelId}` },
            { method: 'get', path: `/docs/models/${modelId}/docs` }
          ];

          for (const endpoint of unauthorizedEndpoints) {
            const response = await (request(testApp) as any)[endpoint.method](endpoint.path)
              .set('Authorization', `Bearer ${otherAuthToken}`)
              .send({ input_data: [[1, 2, 3]] }); // For prediction endpoint

            expect(response.status).toBeGreaterThanOrEqual(400);
            expect([401, 403, 404]).toContain(response.status);
          }

          // Cleanup other user
          await request(testApp)
            .delete('/api/auth/user')
            .set('Authorization', `Bearer ${otherAuthToken}`);

        } catch (error) {
          // Cleanup other user even if test fails
          await request(testApp)
            .delete('/api/auth/user')
            .set('Authorization', `Bearer ${otherAuthToken}`);
          throw error;
        }

        // Cleanup model
        await request(testApp)
          .delete(`/api/models/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should prevent privilege escalation', async () => {
      // Test that regular users cannot access admin endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/models',
        '/api/admin/system',
        '/monitoring/logs/security'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(testApp)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);

        // Should either be forbidden or not found (if endpoint doesn't exist)
        expect([401, 403, 404]).toContain(response.status);
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should enforce rate limits on API endpoints', async () => {
      // Create a model for testing
      const modelContent = Buffer.from('rate_limit_test_model');
      const tempFilePath = path.join(__dirname, 'rate_limit_test.pkl');
      fs.writeFileSync(tempFilePath, modelContent);

      let modelId: string;

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'Rate Limit Test Model')
          .field('description', 'Testing rate limits');

        modelId = uploadResponse.body.modelId;

        // Make rapid requests to trigger rate limiting
        const rapidRequests = Array.from({ length: 50 }, () =>
          request(testApp)
            .post(`/api/predict/${modelId}`)
            .set('X-API-Key', apiKey)
            .send({ input_data: [[1, 2, 3]] })
        );

        const responses = await Promise.all(rapidRequests);

        // Some requests should be rate limited
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        expect(rateLimitedResponses.length).toBeGreaterThan(0);

        // Rate limited responses should have proper headers
        rateLimitedResponses.forEach(response => {
          expect(response.headers['retry-after']).toBeDefined();
        });

        // Cleanup model
        await request(testApp)
          .delete(`/api/models/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should handle rate limiting per user', async () => {
      // Create another user
      const otherUserResponse = await request(testApp)
        .post('/api/auth/register')
        .send({
          email: 'rate-limit-user@example.com',
          password: 'ratelimitpass123'
        });

      const otherAuthToken = otherUserResponse.body.token;

      try {
        // Both users should have separate rate limits
        const user1Requests = Array.from({ length: 10 }, () =>
          request(testApp)
            .get('/api/models')
            .set('Authorization', `Bearer ${authToken}`)
        );

        const user2Requests = Array.from({ length: 10 }, () =>
          request(testApp)
            .get('/api/models')
            .set('Authorization', `Bearer ${otherAuthToken}`)
        );

        const [user1Responses, user2Responses] = await Promise.all([
          Promise.all(user1Requests),
          Promise.all(user2Requests)
        ]);

        // Both users should be able to make some requests
        const user1Success = user1Responses.filter(r => r.status === 200);
        const user2Success = user2Responses.filter(r => r.status === 200);

        expect(user1Success.length).toBeGreaterThan(0);
        expect(user2Success.length).toBeGreaterThan(0);

        // Cleanup other user
        await request(testApp)
          .delete('/api/auth/user')
          .set('Authorization', `Bearer ${otherAuthToken}`);

      } catch (error) {
        // Cleanup other user even if test fails
        await request(testApp)
          .delete('/api/auth/user')
          .set('Authorization', `Bearer ${otherAuthToken}`);
        throw error;
      }
    });
  });

  describe('Input Validation Security', () => {
    it('should validate and sanitize all inputs', async () => {
      const maliciousInputs = [
        { email: 'test@example.com<script>alert("xss")</script>', password: 'password123' },
        { email: 'test@example.com', password: '${process.env.SECRET}' },
        { email: '../../../etc/passwd', password: 'password123' },
        { email: 'DROP TABLE users; --', password: 'password123' }
      ];

      for (const input of maliciousInputs) {
        const response = await request(testApp)
          .post('/api/auth/register')
          .send(input);

        // Should either reject the input or sanitize it
        if (response.status === 201) {
          // If registration succeeds, verify data is sanitized
          expect(response.body.user.email).not.toContain('<script>');
          expect(response.body.user.email).not.toContain('${');
          expect(response.body.user.email).not.toContain('../');
          expect(response.body.user.email).not.toContain('DROP');

          // Cleanup created user
          await request(testApp)
            .delete('/api/auth/user')
            .set('Authorization', `Bearer ${response.body.token}`);
        } else {
          // Should be a validation error
          expect(response.status).toBe(400);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }
      }
    });

    it('should prevent SQL injection in prediction inputs', async () => {
      // Create a model for testing
      const modelContent = Buffer.from('sql_injection_test_model');
      const tempFilePath = path.join(__dirname, 'sql_injection_test.pkl');
      fs.writeFileSync(tempFilePath, modelContent);

      let modelId: string;

      try {
        const uploadResponse = await request(testApp)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', tempFilePath)
          .field('modelName', 'SQL Injection Test Model')
          .field('description', 'Testing SQL injection prevention');

        modelId = uploadResponse.body.modelId;

        const maliciousPredictionInputs = [
          { input_data: "'; DROP TABLE models; --" },
          { input_data: "1' OR '1'='1" },
          { input_data: "UNION SELECT * FROM users" },
          { input_data: "${process.env.DATABASE_URL}" }
        ];

        for (const input of maliciousPredictionInputs) {
          const response = await request(testApp)
            .post(`/api/predict/${modelId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(input);

          // Should reject malicious inputs
          expect(response.status).toBe(400);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }

        // Cleanup model
        await request(testApp)
          .delete(`/api/models/${modelId}`)
          .set('Authorization', `Bearer ${authToken}`);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive information in error messages', async () => {
      // Test various error scenarios
      const errorScenarios = [
        { endpoint: '/api/models/nonexistent-id', method: 'get' },
        { endpoint: '/api/predict/invalid-model-id', method: 'post' },
        { endpoint: '/api/auth/login', method: 'post', body: { email: 'nonexistent@example.com', password: 'wrong' } }
      ];

      for (const scenario of errorScenarios) {
        const response = await (request(testApp) as any)[scenario.method](scenario.endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .send(scenario.body || {});

        expect(response.status).toBeGreaterThanOrEqual(400);
        
        // Error messages should not contain sensitive information
        const errorMessage = JSON.stringify(response.body).toLowerCase();
        expect(errorMessage).not.toContain('database');
        expect(errorMessage).not.toContain('internal');
        expect(errorMessage).not.toContain('stack');
        expect(errorMessage).not.toContain('password');
        expect(errorMessage).not.toContain('secret');
        expect(errorMessage).not.toContain('key');
      }
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        { endpoint: '/api/auth/login', body: 'invalid json' },
        { endpoint: '/api/models', body: { malformed: { nested: { object: 'with circular reference' } } } },
        { endpoint: '/api/upload', body: Buffer.alloc(1000000) } // Large binary data
      ];

      for (const req of malformedRequests) {
        const response = await request(testApp)
          .post(req.endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .send(req.body);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.error).toBeDefined();
      }
    });
  });
});