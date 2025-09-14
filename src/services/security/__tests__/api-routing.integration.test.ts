import request from 'supertest';
import App from '../../../app';

describe('API Routing Integration Tests', () => {
  let app: App;
  let server: any;

  beforeAll(async () => {
    app = new App();
    await app.start();
    server = app.app;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('API Endpoints Return JSON', () => {
    test('GET /api/test should return JSON', async () => {
      const response = await request(server)
        .get('/api/test')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('API is working');
    });

    test('GET /api/models should return JSON array', async () => {
      const response = await request(server)
        .get('/api/models')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/monitoring/user/stats should return JSON object', async () => {
      const response = await request(server)
        .get('/api/monitoring/user/stats')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(typeof response.body).toBe('object');
      expect(response.body).toHaveProperty('totalModels');
    });

    test('GET /api/monitoring/health should return JSON', async () => {
      const response = await request(server)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Static Routes Return HTML', () => {
    test('GET / should return HTML', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('<!DOCTYPE html>');
    });

    test('GET /dashboard should return HTML', async () => {
      const response = await request(server)
        .get('/dashboard')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('<!DOCTYPE html>');
    });
  });

  describe('CSP Headers', () => {
    test('API endpoints should have CSP headers', async () => {
      const response = await request(server)
        .get('/api/models')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
    });

    test('HTML pages should have CSP headers with nonce', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain('nonce-');
    });
  });

  describe('Route Priority', () => {
    test('API routes should take precedence over static files', async () => {
      // Test that /api/models returns JSON, not HTML
      const apiResponse = await request(server)
        .get('/api/models')
        .expect(200);

      expect(apiResponse.headers['content-type']).toMatch(/application\/json/);
      expect(apiResponse.text).not.toContain('<!DOCTYPE html>');
    });

    test('Non-API routes should serve static files or HTML', async () => {
      const staticResponse = await request(server)
        .get('/js/api.js')
        .expect(200);

      expect(staticResponse.headers['content-type']).toMatch(/application\/javascript|text\/javascript/);
    });
  });
});