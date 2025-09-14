import request from 'supertest';
import express from 'express';
import { CSPRoutes } from '../csp.routes';
import { CSPMiddleware } from '../../../services/security/csp.middleware';
import { cspViolationService } from '../../../services/security/csp-violation.service';

// Mock the CSP violation service
jest.mock('../../../services/security/csp-violation.service', () => ({
  cspViolationService: {
    processViolationReport: jest.fn(),
    getViolationStats: jest.fn(),
    getRecentViolations: jest.fn(),
    getViolationsBySeverity: jest.fn(),
    clearViolations: jest.fn()
  }
}));

describe('CSP Routes', () => {
  let app: express.Application;
  let cspMiddleware: CSPMiddleware;
  let cspRoutes: CSPRoutes;

  beforeEach(() => {
    // Create mock CSP middleware
    cspMiddleware = {
      getConfig: jest.fn().mockReturnValue({
        enabled: true,
        reportOnly: false,
        nonce: { enabled: true },
        directives: {
          'script-src': ['\'self\''],
          'style-src': ['\'self\'']
        }
      })
    } as any;

    // Create routes instance
    cspRoutes = new CSPRoutes(cspMiddleware);

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/csp', cspRoutes.getRouter());

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('POST /api/csp/violations', () => {
    const validViolationReport = {
      'document-uri': 'https://example.com/dashboard',
      referrer: 'https://example.com',
      'violated-directive': 'script-src \'self\'',
      'effective-directive': 'script-src',
      'original-policy': 'script-src \'self\'; style-src \'self\'',
      disposition: 'enforce',
      'blocked-uri': 'https://malicious.com/script.js',
      'line-number': 42,
      'column-number': 15,
      'source-file': 'https://example.com/dashboard',
      'status-code': 200,
      'script-sample': 'eval("malicious code")'
    };

    it('should process valid violation report', async () => {
      const mockProcessedViolation = {
        id: 'csp_123456789_abc123',
        severity: 'critical',
        timestamp: new Date(),
        documentUri: validViolationReport['document-uri'],
        violatedDirective: validViolationReport['violated-directive'],
        category: 'script'
      };

      (cspViolationService.processViolationReport as jest.Mock)
        .mockReturnValue(mockProcessedViolation);

      const response = await request(app)
        .post('/api/csp/violations')
        .send(validViolationReport)
        .set('User-Agent', 'Mozilla/5.0 Test Browser')
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(204);

      expect(cspViolationService.processViolationReport).toHaveBeenCalledWith(
        validViolationReport,
        'Mozilla/5.0 Test Browser',
        '192.168.1.1',
        undefined
      );

      expect(response.body).toEqual({
        violationId: mockProcessedViolation.id,
        severity: mockProcessedViolation.severity
      });
    });

    it('should handle validation errors', async () => {
      (cspViolationService.processViolationReport as jest.Mock)
        .mockImplementation(() => {
          throw new Error('Missing required field: document-uri');
        });

      const response = await request(app)
        .post('/api/csp/violations')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Missing required field: document-uri'
      });
    });

    it('should handle processing errors', async () => {
      (cspViolationService.processViolationReport as jest.Mock)
        .mockImplementation(() => {
          throw new Error('Processing failed');
        });

      const response = await request(app)
        .post('/api/csp/violations')
        .send(validViolationReport)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Processing failed'
      });
    });

    it('should handle unexpected errors', async () => {
      (cspViolationService.processViolationReport as jest.Mock)
        .mockImplementation(() => {
          throw 'Unexpected error';
        });

      const response = await request(app)
        .post('/api/csp/violations')
        .send(validViolationReport)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Failed to process violation report'
      });
    });

    it('should pass request headers to violation service', async () => {
      const mockProcessedViolation = {
        id: 'csp_123456789_abc123',
        severity: 'medium'
      };

      (cspViolationService.processViolationReport as jest.Mock)
        .mockReturnValue(mockProcessedViolation);

      await request(app)
        .post('/api/csp/violations')
        .send(validViolationReport)
        .set('User-Agent', 'Chrome/91.0')
        .set('Referer', 'https://example.com/previous')
        .set('X-Forwarded-For', '10.0.0.1')
        .expect(204);

      expect(cspViolationService.processViolationReport).toHaveBeenCalledWith(
        validViolationReport,
        'Chrome/91.0',
        '10.0.0.1',
        'https://example.com/previous'
      );
    });
  });

  describe('GET /api/csp/violations/stats', () => {
    it('should return violation statistics', async () => {
      const mockStats = {
        total: 10,
        byDirective: {
          'script-src': 7,
          'style-src': 3
        },
        byCategory: {
          script: 7,
          style: 3
        },
        bySeverity: {
          critical: 2,
          high: 5,
          medium: 3
        },
        recentViolations: []
      };

      (cspViolationService.getViolationStats as jest.Mock)
        .mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/csp/violations/stats')
        .expect(200);

      expect(response.body).toEqual(mockStats);
      expect(cspViolationService.getViolationStats).toHaveBeenCalledWith(undefined);
    });

    it('should handle time range parameters', async () => {
      const mockStats = { total: 5, byDirective: {}, byCategory: {}, bySeverity: {}, recentViolations: [] };
      (cspViolationService.getViolationStats as jest.Mock).mockReturnValue(mockStats);

      const startDate = '2023-01-01T00:00:00Z';
      const endDate = '2023-01-02T00:00:00Z';

      await request(app)
        .get('/api/csp/violations/stats')
        .query({ start: startDate, end: endDate })
        .expect(200);

      expect(cspViolationService.getViolationStats).toHaveBeenCalledWith({
        start: new Date(startDate),
        end: new Date(endDate)
      });
    });

    it('should handle invalid date parameters', async () => {
      const response = await request(app)
        .get('/api/csp/violations/stats')
        .query({ start: 'invalid-date', end: '2023-01-02T00:00:00Z' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid date format'
      });
    });

    it('should handle service errors', async () => {
      (cspViolationService.getViolationStats as jest.Mock)
        .mockImplementation(() => {
          throw new Error('Service error');
        });

      const response = await request(app)
        .get('/api/csp/violations/stats')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get violation statistics'
      });
    });
  });

  describe('GET /api/csp/violations/recent', () => {
    it('should return recent violations', async () => {
      const mockViolations = [
        {
          id: 'csp_1',
          timestamp: new Date(),
          severity: 'critical',
          category: 'script'
        },
        {
          id: 'csp_2',
          timestamp: new Date(),
          severity: 'high',
          category: 'style'
        }
      ];

      (cspViolationService.getRecentViolations as jest.Mock)
        .mockReturnValue(mockViolations);

      const response = await request(app)
        .get('/api/csp/violations/recent')
        .expect(200);

      expect(response.body).toEqual({
        violations: mockViolations,
        total: mockViolations.length
      });

      expect(cspViolationService.getRecentViolations).toHaveBeenCalledWith(50);
    });

    it('should handle limit parameter', async () => {
      const mockViolations: any[] = [];
      (cspViolationService.getRecentViolations as jest.Mock).mockReturnValue(mockViolations);

      await request(app)
        .get('/api/csp/violations/recent')
        .query({ limit: '10' })
        .expect(200);

      expect(cspViolationService.getRecentViolations).toHaveBeenCalledWith(10);
    });

    it('should filter by severity', async () => {
      const mockViolations = [
        { id: 'csp_1', severity: 'critical' }
      ];

      (cspViolationService.getViolationsBySeverity as jest.Mock)
        .mockReturnValue(mockViolations);

      const response = await request(app)
        .get('/api/csp/violations/recent')
        .query({ severity: 'critical' })
        .expect(200);

      expect(response.body).toEqual({
        violations: mockViolations,
        total: mockViolations.length
      });

      expect(cspViolationService.getViolationsBySeverity).toHaveBeenCalledWith('critical');
    });

    it('should ignore invalid severity values', async () => {
      const mockViolations: any[] = [];
      (cspViolationService.getRecentViolations as jest.Mock).mockReturnValue(mockViolations);

      await request(app)
        .get('/api/csp/violations/recent')
        .query({ severity: 'invalid' })
        .expect(200);

      expect(cspViolationService.getRecentViolations).toHaveBeenCalledWith(50);
      expect(cspViolationService.getViolationsBySeverity).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      (cspViolationService.getRecentViolations as jest.Mock)
        .mockImplementation(() => {
          throw new Error('Service error');
        });

      const response = await request(app)
        .get('/api/csp/violations/recent')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get recent violations'
      });
    });
  });

  describe('GET /api/csp/config', () => {
    it('should return CSP configuration in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/api/csp/config')
        .expect(200);

      expect(response.body).toEqual({
        enabled: true,
        reportOnly: false,
        nonceEnabled: true,
        directives: ['script-src', 'style-src']
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should deny access in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/csp/config')
        .expect(403);

      expect(response.body).toEqual({
        error: 'Configuration access not allowed in production'
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle middleware errors', async () => {
      (cspMiddleware.getConfig as jest.Mock).mockImplementation(() => {
        throw new Error('Config error');
      });

      const response = await request(app)
        .get('/api/csp/config')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get CSP configuration'
      });
    });
  });
});