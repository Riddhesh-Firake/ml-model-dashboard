import { CSPReportingService } from '../csp-reporting.service';
import { cspViolationService, ProcessedViolation } from '../csp-violation.service';

// Mock the violation service
jest.mock('../csp-violation.service');

describe('CSPReportingService', () => {
  let reportingService: CSPReportingService;
  let mockViolations: ProcessedViolation[];

  beforeEach(() => {
    reportingService = new CSPReportingService();
    
    // Create mock violations
    mockViolations = [
      {
        id: 'v1',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        documentUri: 'https://example.com',
        violatedDirective: 'script-src',
        effectiveDirective: 'script-src',
        blockedUri: 'https://malicious.com/script.js',
        sourceFile: 'https://example.com/page.html',
        lineNumber: 10,
        columnNumber: 5,
        scriptSample: 'eval("malicious code")',
        disposition: 'enforce',
        userAgent: 'Mozilla/5.0 (Chrome)',
        ip: '192.168.1.100',
        severity: 'critical',
        category: 'script'
      },
      {
        id: 'v2',
        timestamp: new Date('2023-01-01T11:00:00Z'),
        documentUri: 'https://example.com',
        violatedDirective: 'style-src',
        effectiveDirective: 'style-src',
        blockedUri: 'inline',
        sourceFile: 'https://example.com/page.html',
        lineNumber: 20,
        columnNumber: 10,
        scriptSample: '',
        disposition: 'enforce',
        userAgent: 'Mozilla/5.0 (Firefox)',
        ip: '192.168.1.101',
        severity: 'medium',
        category: 'style'
      },
      {
        id: 'v3',
        timestamp: new Date('2023-01-01T12:00:00Z'),
        documentUri: 'https://example.com',
        violatedDirective: 'script-src',
        effectiveDirective: 'script-src',
        blockedUri: 'https://malicious.com/script.js',
        sourceFile: 'https://example.com/page.html',
        lineNumber: 30,
        columnNumber: 15,
        scriptSample: 'document.write("test")',
        disposition: 'enforce',
        userAgent: 'Mozilla/5.0 (Chrome)',
        ip: '192.168.1.100',
        severity: 'high',
        category: 'script'
      }
    ];

    // Mock the violation service
    (cspViolationService.getRecentViolations as jest.Mock).mockReturnValue(mockViolations);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateViolationAnalysis', () => {
    it('should generate comprehensive violation analysis', async () => {
      const timeframe = {
        start: new Date('2023-01-01T09:00:00Z'),
        end: new Date('2023-01-01T13:00:00Z')
      };

      const analysis = await reportingService.generateViolationAnalysis(timeframe);

      expect(analysis).toBeDefined();
      expect(analysis.id).toMatch(/^analysis_/);
      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.timeframe).toEqual({
        ...timeframe,
        duration: '4 hours'
      });
    });

    it('should calculate correct summary statistics', async () => {
      const timeframe = {
        start: new Date('2023-01-01T09:00:00Z'),
        end: new Date('2023-01-01T13:00:00Z')
      };

      const analysis = await reportingService.generateViolationAnalysis(timeframe);

      expect(analysis.summary).toEqual({
        totalViolations: 3,
        uniqueViolations: 2, // Two unique blocked URIs
        criticalViolations: 1,
        highViolations: 1,
        mediumViolations: 1,
        lowViolations: 0
      });
    });

    it('should analyze trends correctly', async () => {
      const timeframe = {
        start: new Date('2023-01-01T09:00:00Z'),
        end: new Date('2023-01-01T13:00:00Z')
      };

      const analysis = await reportingService.generateViolationAnalysis(timeframe);

      expect(analysis.trends).toBeDefined();
      expect(analysis.trends.violationRate).toBe(0.75); // 3 violations / 4 hours
      expect(analysis.trends.criticalRate).toBe(0.25); // 1 critical / 4 hours
      expect(analysis.trends.peakHour).toBeDefined();
      expect(analysis.trends.quietHour).toBeDefined();
    });

    it('should identify top violations by directive', async () => {
      const timeframe = {
        start: new Date('2023-01-01T09:00:00Z'),
        end: new Date('2023-01-01T13:00:00Z')
      };

      const analysis = await reportingService.generateViolationAnalysis(timeframe);

      expect(analysis.topViolations.byDirective).toHaveLength(2);
      expect(analysis.topViolations.byDirective[0]).toEqual({
        directive: 'script-src',
        count: 2,
        percentage: 67
      });
      expect(analysis.topViolations.byDirective[1]).toEqual({
        directive: 'style-src',
        count: 1,
        percentage: 33
      });
    });

    it('should detect suspicious patterns', async () => {
      const timeframe = {
        start: new Date('2023-01-01T09:00:00Z'),
        end: new Date('2023-01-01T13:00:00Z')
      };

      const analysis = await reportingService.generateViolationAnalysis(timeframe);

      expect(analysis.patterns).toBeDefined();
      expect(analysis.patterns.suspiciousIPs).toHaveLength(0); // Need >5 violations for suspicious
      expect(analysis.patterns.repeatedBlocks).toHaveLength(0); // Need >3 for repeated
      expect(analysis.patterns.scriptInjectionAttempts).toHaveLength(2);
      expect(analysis.patterns.anomalies).toBeDefined();
    });

    it('should generate security recommendations', async () => {
      const timeframe = {
        start: new Date('2023-01-01T09:00:00Z'),
        end: new Date('2023-01-01T13:00:00Z')
      };

      const analysis = await reportingService.generateViolationAnalysis(timeframe, true);

      expect(analysis.recommendations).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      
      // Should recommend investigation for critical violations
      const criticalRecommendation = analysis.recommendations.find(r => r.priority === 'critical');
      expect(criticalRecommendation).toBeDefined();
      expect(criticalRecommendation?.type).toBe('security_alert');
    });

    it('should not generate recommendations when disabled', async () => {
      const timeframe = {
        start: new Date('2023-01-01T09:00:00Z'),
        end: new Date('2023-01-01T13:00:00Z')
      };

      const analysis = await reportingService.generateViolationAnalysis(timeframe, false);

      expect(analysis.recommendations).toHaveLength(0);
    });
  });

  describe('generateTrendingReport', () => {
    it('should generate daily trending report', async () => {
      const timeframe = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-01T23:59:59Z')
      };

      const report = await reportingService.generateTrendingReport('daily', timeframe);

      expect(report).toBeDefined();
      expect(report.id).toMatch(/^report_/);
      expect(report.period).toBe('daily');
      expect(report.timeframe).toEqual(timeframe);
      expect(report.metrics).toBeDefined();
      expect(report.topTrends).toBeDefined();
      expect(report.comparisons).toBeDefined();
      expect(report.forecasting).toBeDefined();
    });

    it('should calculate correct trend metrics', async () => {
      const timeframe = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-01T23:59:59Z')
      };

      const report = await reportingService.generateTrendingReport('daily', timeframe);

      expect(report.metrics.totalViolations).toBe(3);
      expect(report.metrics.averageViolationsPerPeriod).toBeCloseTo(0.125, 2); // 3 violations / 24 hours
      expect(report.metrics.criticalViolationRate).toBeCloseTo(33.33, 1); // 1/3 * 100
    });

    it('should generate comparisons with previous period', async () => {
      const timeframe = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-01T23:59:59Z')
      };

      // Mock previous period violations (empty)
      (cspViolationService.getRecentViolations as jest.Mock)
        .mockReturnValueOnce(mockViolations) // Current period
        .mockReturnValueOnce([]); // Previous period

      const report = await reportingService.generateTrendingReport('daily', timeframe);

      expect(report.comparisons.previousPeriod.totalViolations).toBe(0);
      expect(report.comparisons.previousPeriod.changePercentage).toBe(0);
    });

    it('should generate forecasting data', async () => {
      const timeframe = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-01T23:59:59Z')
      };

      const report = await reportingService.generateTrendingReport('daily', timeframe);

      expect(report.forecasting.nextPeriodPrediction).toBeDefined();
      expect(report.forecasting.confidence).toBeGreaterThan(0);
      expect(report.forecasting.confidence).toBeLessThanOrEqual(1);
      expect(['increasing', 'decreasing', 'stable']).toContain(report.forecasting.trendDirection);
      expect(['low', 'medium', 'high', 'critical']).toContain(report.forecasting.riskLevel);
    });
  });

  describe('generateDailyReport', () => {
    it('should generate daily report for last 24 hours', async () => {
      const report = await reportingService.generateDailyReport();

      expect(report).toBeDefined();
      expect(report.period).toBe('daily');
      
      // Check that timeframe is approximately last 24 hours
      const now = new Date();
      const timeDiff = now.getTime() - report.timeframe.end.getTime();
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute of now
      
      const duration = report.timeframe.end.getTime() - report.timeframe.start.getTime();
      expect(duration).toBeCloseTo(24 * 60 * 60 * 1000, -3); // Approximately 24 hours (within 1000ms)
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate weekly report for last 7 days', async () => {
      const report = await reportingService.generateWeeklyReport();

      expect(report).toBeDefined();
      expect(report.period).toBe('weekly');
      
      // Check that timeframe is approximately last 7 days
      const now = new Date();
      const timeDiff = now.getTime() - report.timeframe.end.getTime();
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute of now
      
      const duration = report.timeframe.end.getTime() - report.timeframe.start.getTime();
      expect(duration).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -3); // Approximately 7 days (within 1000ms)
    });
  });

  describe('getAnalysisHistory', () => {
    it('should return analysis history in reverse chronological order', async () => {
      // Generate a few analyses
      const timeframe = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-01T23:59:59Z')
      };

      await reportingService.generateViolationAnalysis(timeframe);
      await reportingService.generateViolationAnalysis(timeframe);

      const history = reportingService.getAnalysisHistory(10);

      expect(history).toHaveLength(2);
      expect(history[0]?.timestamp.getTime()).toBeGreaterThanOrEqual(history[1]?.timestamp.getTime() || 0);
    });

    it('should limit results to specified count', async () => {
      // Generate multiple analyses
      const timeframe = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-01T23:59:59Z')
      };

      for (let i = 0; i < 5; i++) {
        await reportingService.generateViolationAnalysis(timeframe);
      }

      const history = reportingService.getAnalysisHistory(3);

      expect(history).toHaveLength(3);
    });
  });

  describe('getTrendingReports', () => {
    it('should return trending reports in reverse chronological order', async () => {
      const timeframe = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-01T23:59:59Z')
      };

      await reportingService.generateTrendingReport('daily', timeframe);
      await reportingService.generateTrendingReport('daily', timeframe);

      const reports = reportingService.getTrendingReports(10);

      expect(reports).toHaveLength(2);
      expect(reports[0]?.generatedAt.getTime()).toBeGreaterThanOrEqual(reports[1]?.generatedAt.getTime() || 0);
    });

    it('should limit results to specified count', async () => {
      const timeframe = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-01T23:59:59Z')
      };

      for (let i = 0; i < 5; i++) {
        await reportingService.generateTrendingReport('daily', timeframe);
      }

      const reports = reportingService.getTrendingReports(3);

      expect(reports).toHaveLength(3);
    });
  });
});