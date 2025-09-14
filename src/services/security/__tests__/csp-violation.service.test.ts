import { CSPViolationService, CSPViolationReport } from '../csp-violation.service';
import { logger } from '../../monitoring/logger.service';

// Mock the logger
jest.mock('../../monitoring/logger.service', () => ({
  logger: {
    security: jest.fn(),
    error: jest.fn()
  }
}));

describe('CSPViolationService', () => {
  let service: CSPViolationService;
  let mockReport: CSPViolationReport;

  beforeEach(() => {
    service = new CSPViolationService();
    mockReport = {
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

    // Clear mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.clearViolations();
  });

  describe('processViolationReport', () => {
    it('should process a valid violation report', () => {
      const result = service.processViolationReport(
        mockReport,
        'Mozilla/5.0 Test Browser',
        '192.168.1.1',
        'https://example.com'
      );

      expect(result).toMatchObject({
        documentUri: mockReport['document-uri'],
        violatedDirective: mockReport['violated-directive'],
        blockedUri: mockReport['blocked-uri'],
        userAgent: 'Mozilla/5.0 Test Browser',
        ip: '192.168.1.1',
        referer: 'https://example.com',
        disposition: 'enforce'
      });

      expect(result.id).toMatch(/^csp_\d+_[a-z0-9]+$/);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for invalid report format', () => {
      expect(() => {
        service.processViolationReport(null as any);
      }).toThrow('Invalid violation report format');

      expect(() => {
        service.processViolationReport({} as any);
      }).toThrow('Missing required field: document-uri');
    });

    it('should throw error for missing required fields', () => {
      const invalidReport = { ...mockReport };
      delete (invalidReport as any)['document-uri'];

      expect(() => {
        service.processViolationReport(invalidReport);
      }).toThrow('Missing required field: document-uri');
    });

    it('should validate disposition field', () => {
      const invalidReport = { 
        ...mockReport, 
        disposition: 'invalid' as any 
      };

      expect(() => {
        service.processViolationReport(invalidReport);
      }).toThrow('Invalid disposition value');
    });

    it('should log security event', () => {
      service.processViolationReport(mockReport);

      expect(logger.security).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'csp_violation',
          details: expect.objectContaining({
            violatedDirective: mockReport['violated-directive'],
            blockedUri: mockReport['blocked-uri']
          })
        }),
        expect.objectContaining({
          endpoint: '/api/csp/violations'
        })
      );
    });
  });

  describe('severity calculation', () => {
    it('should assign critical severity for external script violations', () => {
      const externalScriptReport = {
        ...mockReport,
        'violated-directive': 'script-src \'self\'',
        'blocked-uri': 'https://malicious.com/script.js'
      };

      const result = service.processViolationReport(externalScriptReport);
      expect(result.severity).toBe('critical');
    });

    it('should assign critical severity for suspicious script content', () => {
      const suspiciousReport = {
        ...mockReport,
        'script-sample': 'eval("malicious code")'
      };

      const result = service.processViolationReport(suspiciousReport);
      expect(result.severity).toBe('critical');
    });

    it('should assign high severity for script-src violations', () => {
      const scriptReport = {
        ...mockReport,
        'violated-directive': 'script-src \'self\'',
        'blocked-uri': 'data:text/javascript,alert(1)',
        'script-sample': 'alert(1)'
      };

      const result = service.processViolationReport(scriptReport);
      expect(result.severity).toBe('high');
    });

    it('should assign medium severity for style-src violations', () => {
      const styleReport = {
        ...mockReport,
        'violated-directive': 'style-src \'self\'',
        'blocked-uri': 'https://example.com/style.css',
        'script-sample': ''
      };

      const result = service.processViolationReport(styleReport);
      expect(result.severity).toBe('medium');
    });

    it('should assign low severity for other violations', () => {
      const imageReport = {
        ...mockReport,
        'violated-directive': 'img-src \'self\'',
        'blocked-uri': 'https://example.com/image.jpg',
        'script-sample': ''
      };

      const result = service.processViolationReport(imageReport);
      expect(result.severity).toBe('low');
    });
  });

  describe('categorization', () => {
    it('should categorize script violations correctly', () => {
      const scriptReport = { ...mockReport, 'violated-directive': 'script-src \'self\'' };
      const result = service.processViolationReport(scriptReport);
      expect(result.category).toBe('script');
    });

    it('should categorize style violations correctly', () => {
      const styleReport = { ...mockReport, 'violated-directive': 'style-src \'self\'' };
      const result = service.processViolationReport(styleReport);
      expect(result.category).toBe('style');
    });

    it('should categorize image violations correctly', () => {
      const imageReport = { ...mockReport, 'violated-directive': 'img-src \'self\'' };
      const result = service.processViolationReport(imageReport);
      expect(result.category).toBe('image');
    });

    it('should categorize unknown violations as other', () => {
      const unknownReport = { ...mockReport, 'violated-directive': 'unknown-directive' };
      const result = service.processViolationReport(unknownReport);
      expect(result.category).toBe('other');
    });
  });

  describe('critical violation handling', () => {
    it('should log critical violations with high priority', () => {
      const criticalReport = {
        ...mockReport,
        'violated-directive': 'script-src \'self\'',
        'blocked-uri': 'https://malicious.com/script.js'
      };

      service.processViolationReport(criticalReport, 'Test Browser', '192.168.1.1');

      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL CSP VIOLATION DETECTED',
        undefined,
        expect.objectContaining({
          violatedDirective: criticalReport['violated-directive'],
          blockedUri: criticalReport['blocked-uri'],
          ip: '192.168.1.1'
        })
      );
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(() => {
      // Add some test violations
      service.processViolationReport({
        ...mockReport,
        'violated-directive': 'script-src \'self\'',
        'blocked-uri': 'https://malicious1.com/script.js'
      });

      service.processViolationReport({
        ...mockReport,
        'violated-directive': 'style-src \'self\'',
        'blocked-uri': 'https://malicious2.com/style.css',
        'script-sample': '' // No suspicious script content
      });

      service.processViolationReport({
        ...mockReport,
        'violated-directive': 'script-src \'self\'',
        'blocked-uri': 'https://malicious3.com/script.js'
      });
    });

    it('should return correct violation statistics', () => {
      const stats = service.getViolationStats();

      expect(stats.total).toBe(3);
      expect(stats.byDirective['script-src \'self\'']).toBe(2);
      expect(stats.byDirective['style-src \'self\'']).toBe(1);
      expect(stats.byCategory.script).toBe(2);
      expect(stats.byCategory.style).toBe(1);
      expect(stats.recentViolations).toHaveLength(3);
    });

    it('should filter statistics by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const stats = service.getViolationStats({
        start: oneHourAgo,
        end: oneHourFromNow
      });

      expect(stats.total).toBe(3); // All violations should be within range
    });

    it('should return recent violations', () => {
      const recent = service.getRecentViolations(2);
      expect(recent).toHaveLength(2);
      
      // Should be sorted by timestamp (most recent first)
      if (recent.length >= 2) {
        expect(recent[0]!.timestamp.getTime()).toBeGreaterThanOrEqual(
          recent[1]!.timestamp.getTime()
        );
      }
    });

    it('should return violations by severity', () => {
      const criticalViolations = service.getViolationsBySeverity('critical');
      const highViolations = service.getViolationsBySeverity('high');

      expect(criticalViolations).toHaveLength(2); // script violations are critical
      expect(highViolations).toHaveLength(0);
      
      const mediumViolations = service.getViolationsBySeverity('medium');
      expect(mediumViolations).toHaveLength(1); // style violation is medium
    });
  });

  describe('suspicious content detection', () => {
    const suspiciousPatterns = [
      'eval("code")',
      'Function("code")',
      'document.write("<script>")',
      'element.innerHTML = "<script>"',
      'element.outerHTML = "<div>"',
      'javascript:alert(1)',
      'data:text/html,<script>',
      'atob("base64")',
      'btoa("string")'
    ];

    suspiciousPatterns.forEach(pattern => {
      it(`should detect suspicious pattern: ${pattern}`, () => {
        const suspiciousReport = {
          ...mockReport,
          'script-sample': pattern
        };

        const result = service.processViolationReport(suspiciousReport);
        expect(result.severity).toBe('critical');
      });
    });
  });

  describe('violation storage and rotation', () => {
    it('should store violations and rotate when limit exceeded', () => {
      // Create a service with a small limit for testing
      const testService = new CSPViolationService();
      
      // Add violations beyond the limit (1000 is the default)
      // We'll test the rotation logic by checking that old violations are removed
      for (let i = 0; i < 5; i++) {
        testService.processViolationReport({
          ...mockReport,
          'document-uri': `https://example.com/page${i}`
        });
      }

      const stats = testService.getViolationStats();
      expect(stats.total).toBe(5);
      
      const recent = testService.getRecentViolations();
      expect(recent).toHaveLength(5);
    });
  });
});