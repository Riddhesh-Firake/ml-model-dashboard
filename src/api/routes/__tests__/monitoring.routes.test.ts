import request from 'supertest';
import express from 'express';
import monitoringRoutes from '../monitoring.routes';
import { healthCheck } from '../../../services/monitoring/health-check.service';
import { performanceMonitor } from '../../../services/monitoring/performance-monitor.service';
import { logAnalyzer } from '../../../services/monitoring/log-analyzer.service';
import { logger } from '../../../services/monitoring/logger.service';

// Mock dependencies
jest.mock('../../../services/monitoring/health-check.service');
jest.mock('../../../services/monitoring/performance-monitor.service');
jest.mock('../../../services/monitoring/log-analyzer.service');
jest.mock('../../../services/monitoring/logger.service');

const mockHealthCheck = healthCheck as jest.Mocked<typeof healthCheck>;
const mockPerformanceMonitor = performanceMonitor as jest.Mocked<typeof performanceMonitor>;
const mockLogAnalyzer = logAnalyzer as jest.Mocked<typeof logAnalyzer>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('MonitoringRoutes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/monitoring', monitoringRoutes);

    // Mock health check endpoints
    mockHealthCheck.healthEndpoint = jest.fn().mockReturnValue((req: any, res: any) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 12345,
        version: '1.0.0',
        checks: {
          database: 'healthy',
          storage: 'healthy'
        }
      });
    });

    mockHealthCheck.livenessEndpoint = jest.fn().mockReturnValue((req: any, res: any) => {
      res.json({
        status: 'alive',
        timestamp: new Date().toISOString()
      });
    });

    mockHealthCheck.readinessEndpoint = jest.fn().mockReturnValue((req: any, res: any) => {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    });

    mockHealthCheck.metricsEndpoint = jest.fn().mockReturnValue((req: any, res: any) => {
      res.setHeader('Content-Type', 'text/plain');
      res.send('# HELP http_requests_total Total HTTP requests\nhttp_requests_total 100');
    });

    mockHealthCheck.getSystemHealth = jest.fn().mockResolvedValue({
      cpu: { usage: 45.2 },
      memory: { usage: 67.8, total: 8192, free: 2637 },
      disk: { usage: 23.4, total: 500000, free: 383000 }
    });
  });

  describe('GET /monitoring/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/monitoring/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.checks).toBeDefined();
      expect(mockHealthCheck.healthEndpoint).toHaveBeenCalled();
    });
  });

  describe('GET /monitoring/health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/monitoring/health/live')
        .expect(200);

      expect(response.body.status).toBe('alive');
      expect(response.body.timestamp).toBeDefined();
      expect(mockHealthCheck.livenessEndpoint).toHaveBeenCalled();
    });
  });

  describe('GET /monitoring/health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/monitoring/health/ready')
        .expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.timestamp).toBeDefined();
      expect(mockHealthCheck.readinessEndpoint).toHaveBeenCalled();
    });
  });

  describe('GET /monitoring/metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('http_requests_total');
      expect(mockHealthCheck.metricsEndpoint).toHaveBeenCalled();
    });
  });

  describe('GET /monitoring/performance', () => {
    it('should return performance summary', async () => {
      const mockPerformanceSummary = {
        requests: {
          total: 1000,
          successful: 950,
          failed: 50,
          averageResponseTime: 125.5
        },
        endpoints: {
          '/api/predict': { count: 500, avgTime: 200 },
          '/api/upload': { count: 300, avgTime: 1500 }
        }
      };

      mockPerformanceMonitor.getPerformanceSummary.mockReturnValue(mockPerformanceSummary);

      const response = await request(app)
        .get('/monitoring/performance')
        .expect(200);

      expect(response.body.performance).toEqual(mockPerformanceSummary);
      expect(response.body.system).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(mockPerformanceMonitor.getPerformanceSummary).toHaveBeenCalled();
      expect(mockHealthCheck.getSystemHealth).toHaveBeenCalled();
    });

    it('should handle performance summary errors', async () => {
      mockPerformanceMonitor.getPerformanceSummary.mockImplementation(() => {
        throw new Error('Performance service failed');
      });

      const response = await request(app)
        .get('/monitoring/performance')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve performance data');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get performance summary',
        expect.any(Error)
      );
    });
  });

  describe('GET /monitoring/logs/analyze', () => {
    it('should return log analysis with default parameters', async () => {
      const mockAnalysis = {
        totalLogs: 5000,
        totalRequests: 1000,
        errorCount: 25,
        errorRate: 2.5,
        warnCount: 150,
        infoCount: 4825,
        averageResponseTime: 125,
        topErrors: [
          { message: 'Database connection failed', count: 10 },
          { message: 'File not found', count: 8 }
        ],
        topEndpoints: [
          { endpoint: '/api/predict', count: 500 },
          { endpoint: '/api/upload', count: 300 }
        ],
        trends: {
          hourly: [10, 15, 8, 12, 20, 18, 25, 30]
        },
        timeRange: {
          start: new Date(),
          end: new Date()
        }
      };

      mockLogAnalyzer.analyzeApplicationLogs.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .get('/monitoring/logs/analyze')
        .expect(200);

      expect(response.body.analysis).toEqual(mockAnalysis);
      expect(response.body.period.hours).toBe(24);
      expect(response.body.timestamp).toBeDefined();
      expect(mockLogAnalyzer.analyzeApplicationLogs).toHaveBeenCalledWith({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        level: undefined
      });
    });

    it('should return log analysis with custom parameters', async () => {
      const mockAnalysis = {
        totalLogs: 100,
        totalRequests: 50,
        errorCount: 100,
        errorRate: 100,
        warnCount: 0,
        infoCount: 0,
        averageResponseTime: 200,
        topErrors: [{ message: 'Critical error', count: 50 }],
        topEndpoints: [{ endpoint: '/api/test', count: 50 }],
        trends: { hourly: [25, 25, 25, 25] },
        timeRange: {
          start: new Date(),
          end: new Date()
        }
      };

      mockLogAnalyzer.analyzeApplicationLogs.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .get('/monitoring/logs/analyze?hours=4&level=error')
        .expect(200);

      expect(response.body.analysis).toEqual(mockAnalysis);
      expect(response.body.period.hours).toBe(4);
      expect(mockLogAnalyzer.analyzeApplicationLogs).toHaveBeenCalledWith({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        level: 'error'
      });
    });

    it('should handle log analysis errors', async () => {
      mockLogAnalyzer.analyzeApplicationLogs.mockRejectedValue(new Error('Analysis failed'));

      const response = await request(app)
        .get('/monitoring/logs/analyze')
        .expect(500);

      expect(response.body.error).toBe('Failed to analyze logs');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to analyze logs',
        expect.any(Error)
      );
    });
  });

  describe('GET /monitoring/logs/errors', () => {
    it('should return error summary', async () => {
      const mockErrorSummary = {
        totalErrors: 45,
        uniqueErrors: 12,
        topErrors: [
          { message: 'Database timeout', count: 15, lastOccurrence: new Date() },
          { message: 'Invalid input', count: 10, lastOccurrence: new Date() }
        ],
        errorsByHour: [2, 5, 3, 8, 12, 15]
      };

      mockLogAnalyzer.getErrorSummary.mockResolvedValue(mockErrorSummary);

      const response = await request(app)
        .get('/monitoring/logs/errors')
        .expect(200);

      expect(response.body.errors).toEqual(mockErrorSummary);
      expect(response.body.period.hours).toBe(24);
      expect(response.body.timestamp).toBeDefined();
      expect(mockLogAnalyzer.getErrorSummary).toHaveBeenCalledWith(24);
    });

    it('should return error summary with custom hours', async () => {
      const mockErrorSummary = {
        totalErrors: 10,
        uniqueErrors: 3,
        topErrors: [],
        errorsByHour: [5, 3, 2]
      };

      mockLogAnalyzer.getErrorSummary.mockResolvedValue(mockErrorSummary);

      const response = await request(app)
        .get('/monitoring/logs/errors?hours=3')
        .expect(200);

      expect(response.body.period.hours).toBe(3);
      expect(mockLogAnalyzer.getErrorSummary).toHaveBeenCalledWith(3);
    });

    it('should handle error summary failures', async () => {
      mockLogAnalyzer.getErrorSummary.mockRejectedValue(new Error('Summary failed'));

      const response = await request(app)
        .get('/monitoring/logs/errors')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve error summary');
    });
  });

  describe('GET /monitoring/logs/security', () => {
    it('should return security events', async () => {
      const mockSecurityEvents = {
        totalEvents: 25,
        criticalEvents: 2,
        warningEvents: 8,
        infoEvents: 15,
        events: [
          {
            type: 'failed_login',
            severity: 'warning',
            timestamp: new Date(),
            details: { ip: '192.168.1.100', attempts: 3 }
          },
          {
            type: 'suspicious_upload',
            severity: 'critical',
            timestamp: new Date(),
            details: { userId: 'user-123', filename: 'malicious.exe' }
          }
        ]
      };

      mockLogAnalyzer.analyzeSecurityLogs.mockResolvedValue(mockSecurityEvents as any);

      const response = await request(app)
        .get('/monitoring/logs/security')
        .expect(200);

      expect(response.body.events).toEqual(mockSecurityEvents);
      expect(response.body.period.hours).toBe(24);
      expect(response.body.timestamp).toBeDefined();
      expect(mockLogAnalyzer.analyzeSecurityLogs).toHaveBeenCalledWith({
        startDate: expect.any(Date),
        endDate: expect.any(Date)
      });
    });

    it('should handle security analysis errors', async () => {
      mockLogAnalyzer.analyzeSecurityLogs.mockRejectedValue(new Error('Security analysis failed'));

      const response = await request(app)
        .get('/monitoring/logs/security')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve security events');
    });
  });

  describe('GET /monitoring/logs/search', () => {
    it('should search logs with required search term', async () => {
      const mockSearchResults = [
        {
          timestamp: new Date(),
          level: 'error',
          message: 'Database connection failed',
          context: { userId: 'user-123' }
        },
        {
          timestamp: new Date(),
          level: 'warn',
          message: 'Database connection slow',
          context: { responseTime: 5000 }
        }
      ];

      mockLogAnalyzer.searchLogs.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/monitoring/logs/search?q=database')
        .expect(200);

      expect(response.body.results).toEqual(mockSearchResults);
      expect(response.body.searchTerm).toBe('database');
      expect(response.body.count).toBe(2);
      expect(response.body.period.hours).toBe(24);
      expect(response.body.timestamp).toBeDefined();
      expect(mockLogAnalyzer.searchLogs).toHaveBeenCalledWith('database', {
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        limit: 100
      });
    });

    it('should search logs with custom parameters', async () => {
      mockLogAnalyzer.searchLogs.mockResolvedValue([]);

      const response = await request(app)
        .get('/monitoring/logs/search?q=error&hours=12&limit=50')
        .expect(200);

      expect(response.body.searchTerm).toBe('error');
      expect(response.body.period.hours).toBe(12);
      expect(mockLogAnalyzer.searchLogs).toHaveBeenCalledWith('error', {
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        limit: 50
      });
    });

    it('should return 400 when search term is missing', async () => {
      const response = await request(app)
        .get('/monitoring/logs/search')
        .expect(400);

      expect(response.body.error).toBe('Search term (q) is required');
    });

    it('should handle search errors', async () => {
      mockLogAnalyzer.searchLogs.mockRejectedValue(new Error('Search failed'));

      const response = await request(app)
        .get('/monitoring/logs/search?q=test')
        .expect(500);

      expect(response.body.error).toBe('Failed to search logs');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to search logs',
        expect.any(Error)
      );
    });
  });
});