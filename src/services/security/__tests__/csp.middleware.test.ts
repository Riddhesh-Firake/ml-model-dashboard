import { Request, Response, NextFunction } from 'express';
import { CSPMiddleware, CSPConfig } from '../csp.middleware';

describe('CSPMiddleware', () => {
  let cspMiddleware: CSPMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const testConfig: CSPConfig = {
    enabled: true,
    reportOnly: false,
    nonce: {
      enabled: true,
      length: 16,
      algorithm: 'base64'
    },
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'", 'https:', 'data:'],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
      'report-uri': ['/api/csp-violations']
    }
  };

  beforeEach(() => {
    cspMiddleware = new CSPMiddleware(testConfig);
    mockRequest = {
      body: {},
      ip: '127.0.0.1',
      get: jest.fn()
    };
    mockResponse = {
      locals: {},
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('generateNonce', () => {
    it('should generate a base64 nonce of correct length', () => {
      const nonce = cspMiddleware.generateNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
      // Base64 encoded 16 bytes should be around 22-24 characters
      expect(nonce.length).toBeGreaterThanOrEqual(20);
    });

    it('should generate different nonces on each call', () => {
      const nonce1 = cspMiddleware.generateNonce();
      const nonce2 = cspMiddleware.generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('buildCSPHeader', () => {
    it('should build CSP header without nonce', () => {
      const header = cspMiddleware.buildCSPHeader();
      expect(header).toContain("default-src 'self'");
      expect(header).toContain("script-src 'self'");
      expect(header).toContain("object-src 'none'");
      expect(header).toContain('report-uri /api/csp-violations');
    });

    it('should build CSP header with nonce', () => {
      const nonce = 'test-nonce-123';
      const header = cspMiddleware.buildCSPHeader(nonce);
      expect(header).toContain("script-src 'self' 'nonce-test-nonce-123'");
      expect(header).toContain("style-src 'self' 'nonce-test-nonce-123'");
    });

    it('should not include empty directive arrays', () => {
      const configWithEmptyDirective: CSPConfig = {
        ...testConfig,
        directives: {
          ...testConfig.directives,
          'frame-src': []
        }
      };
      const middleware = new CSPMiddleware(configWithEmptyDirective);
      const header = middleware.buildCSPHeader();
      expect(header).not.toContain('frame-src');
    });
  });

  describe('middleware', () => {
    it('should set CSP header when enabled', () => {
      const middleware = cspMiddleware.middleware();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set nonce in response locals when nonce is enabled', () => {
      const middleware = cspMiddleware.middleware();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.locals).toHaveProperty('cspNonce');
      expect(typeof mockResponse.locals!.cspNonce).toBe('string');
    });

    it('should use report-only header when reportOnly is true', () => {
      const reportOnlyConfig = { ...testConfig, reportOnly: true };
      const reportOnlyMiddleware = new CSPMiddleware(reportOnlyConfig);
      const middleware = reportOnlyMiddleware.middleware();
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy-Report-Only',
        expect.any(String)
      );
    });

    it('should skip CSP when disabled', () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledMiddleware = new CSPMiddleware(disabledConfig);
      const middleware = disabledMiddleware.middleware();
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('handleViolationReport', () => {
    it('should handle valid violation report', () => {
      const violationReport = {
        'document-uri': 'http://localhost:3000/',
        'violated-directive': 'script-src',
        'blocked-uri': 'inline',
        'source-file': 'http://localhost:3000/',
        'line-number': 1,
        'column-number': 1,
        'script-sample': 'console.log("test")'
      };

      mockRequest.body = violationReport;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const handler = cspMiddleware.handleViolationReport();
      handler(mockRequest as Request, mockResponse as Response);

      expect(consoleSpy).toHaveBeenCalledWith(
        'CSP Violation Report:',
        expect.objectContaining({
          documentUri: 'http://localhost:3000/',
          violatedDirective: 'script-src'
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle invalid violation report', () => {
      mockRequest.body = { invalid: 'data' };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const handler = cspMiddleware.handleViolationReport();
      handler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing required violation report fields'
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = { enabled: false };
      cspMiddleware.updateConfig(newConfig);
      
      const config = cspMiddleware.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.reportOnly).toBe(testConfig.reportOnly); // Should preserve other settings
    });

    it('should return current configuration', () => {
      const config = cspMiddleware.getConfig();
      expect(config).toEqual(testConfig);
      expect(config).not.toBe(testConfig); // Should be a copy
    });
  });
});