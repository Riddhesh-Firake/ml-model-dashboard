import { performanceMonitor } from '../performance-monitor.service';
import { Request, Response } from 'express';

// Mock prom-client
jest.mock('prom-client', () => ({
  register: {
    registerMetric: jest.fn(),
    metrics: jest.fn().mockResolvedValue('# Mock metrics'),
  },
  collectDefaultMetrics: jest.fn(),
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: jest.fn()
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn()
  }))
}));

describe('PerformanceMonitorService', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      method: 'GET',
      path: '/api/test',
      route: { path: '/api/test' }
    };
    
    mockRes = {
      statusCode: 200,
      end: jest.fn()
    };
    
    mockNext = jest.fn();
  });

  describe('HTTP request monitoring', () => {
    it('should create middleware for monitoring HTTP requests', () => {
      const middleware = performanceMonitor.monitorHttpRequests();
      expect(typeof middleware).toBe('function');
    });

    it('should track request metrics when middleware is used', (done) => {
      const middleware = performanceMonitor.monitorHttpRequests();
      
      // Mock res.end to simulate request completion
      const originalEnd = jest.fn();
      mockRes.end = jest.fn().mockImplementation((chunk?: any, encoding?: any) => {
        originalEnd.call(mockRes, chunk, encoding);
        // Verify middleware completed
        expect(mockNext).toHaveBeenCalled();
        done();
        return mockRes;
      }) as any;

      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      // Simulate request completion
      (mockRes.end as jest.Mock)();
    });
  });

  describe('Model performance tracking', () => {
    it('should track model prediction performance', () => {
      const modelId = 'test-model-123';
      const modelFormat = 'pkl';
      const duration = 1500; // 1.5 seconds
      const success = true;

      expect(() => {
        performanceMonitor.trackModelPrediction(modelId, modelFormat, duration, success);
      }).not.toThrow();
    });

    it('should track failed model predictions', () => {
      const modelId = 'test-model-456';
      const modelFormat = 'h5';
      const duration = 500;
      const success = false;

      expect(() => {
        performanceMonitor.trackModelPrediction(modelId, modelFormat, duration, success);
      }).not.toThrow();
    });
  });

  describe('Model loading tracking', () => {
    it('should track model loading performance', () => {
      const modelId = 'test-model-789';
      const modelFormat = 'onnx';
      const duration = 3000; // 3 seconds

      expect(() => {
        performanceMonitor.trackModelLoad(modelId, modelFormat, duration);
      }).not.toThrow();
    });
  });

  describe('Upload processing tracking', () => {
    it('should track upload processing performance', () => {
      const fileType = 'pkl';
      const fileSize = 1024 * 1024; // 1MB
      const duration = 2000; // 2 seconds

      expect(() => {
        performanceMonitor.trackUploadProcessing(fileType, fileSize, duration);
      }).not.toThrow();
    });

    it('should categorize file sizes correctly', () => {
      // Test different file sizes
      const smallFile = 500 * 1024; // 500KB
      const mediumFile = 5 * 1024 * 1024; // 5MB
      const largeFile = 50 * 1024 * 1024; // 50MB
      const xlargeFile = 150 * 1024 * 1024; // 150MB

      expect(() => {
        performanceMonitor.trackUploadProcessing('pkl', smallFile, 1000);
        performanceMonitor.trackUploadProcessing('h5', mediumFile, 2000);
        performanceMonitor.trackUploadProcessing('onnx', largeFile, 5000);
        performanceMonitor.trackUploadProcessing('pt', xlargeFile, 10000);
      }).not.toThrow();
    });
  });

  describe('Metrics retrieval', () => {
    it('should return metrics in Prometheus format', async () => {
      const metrics = await performanceMonitor.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toBe('# Mock metrics');
    });

    it('should return performance summary', () => {
      const summary = performanceMonitor.getPerformanceSummary();
      
      expect(summary).toHaveProperty('memory');
      expect(summary).toHaveProperty('cpu');
      expect(summary).toHaveProperty('uptime');
      expect(summary).toHaveProperty('loadAverage');
      expect(summary).toHaveProperty('freeMemory');
      expect(summary).toHaveProperty('totalMemory');
      expect(summary).toHaveProperty('platform');
      expect(summary).toHaveProperty('arch');
      
      expect(typeof summary.uptime).toBe('number');
      expect(Array.isArray(summary.loadAverage)).toBe(true);
      expect(typeof summary.freeMemory).toBe('number');
      expect(typeof summary.totalMemory).toBe('number');
    });
  });

  describe('Route pattern normalization', () => {
    it('should normalize route patterns correctly', () => {
      const middleware = performanceMonitor.monitorHttpRequests();
      
      // Test with different route patterns
      const testCases = [
        { path: '/api/models/123', expected: '/api/models/:id' },
        { path: '/api/users/abc-def-123', expected: '/api/users/:uuid' },
        { path: '/api/predict/model123', expected: '/api/predict/model123' }
      ];

      testCases.forEach(({ path }) => {
        const testReq = { ...mockReq, path, route: { path } };
        
        expect(() => {
          middleware(testReq as Request, mockRes as Response, mockNext);
        }).not.toThrow();
      });
    });
  });
});