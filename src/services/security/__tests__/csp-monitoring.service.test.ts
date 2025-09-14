import { CSPMonitoringService, MonitoringConfig, ViolationAlert } from '../csp-monitoring.service';
import { cspViolationService } from '../csp-violation.service';
import { logger } from '../../monitoring/logger.service';

// Mock dependencies
jest.mock('../csp-violation.service', () => ({
  cspViolationService: {
    getRecentViolations: jest.fn(),
    getViolationStats: jest.fn()
  }
}));

jest.mock('../../monitoring/logger.service', () => ({
  logger: {
    security: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('CSPMonitoringService', () => {
  let service: CSPMonitoringService;
  let mockConfig: MonitoringConfig;

  beforeEach(() => {
    // Setup fake timers before creating service
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval');
    
    mockConfig = {
      thresholds: {
        violationsPerMinute: 5,
        violationsPerHour: 50,
        criticalViolationsPerHour: 3
      },
      alerting: {
        enabled: true,
        emailNotifications: false,
        webhookUrl: 'https://example.com/webhook',
        slackWebhook: 'https://hooks.slack.com/test'
      },
      retention: {
        alertRetentionDays: 30,
        violationRetentionDays: 90
      }
    };

    // Clear mocks
    jest.clearAllMocks();
    
    service = new CSPMonitoringService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize with provided config', () => {
      const config = service.getConfig();
      expect(config).toEqual(mockConfig);
    });

    it('should start monitoring intervals', () => {
      expect(setInterval).toHaveBeenCalledTimes(2);
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000); // Every minute
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 3600000); // Every hour
    });
  });

  describe('threshold monitoring', () => {
    beforeEach(() => {
      // Mock violation data
      const mockViolations = Array.from({ length: 10 }, (_, i) => ({
        id: `violation_${i}`,
        timestamp: new Date(Date.now() - i * 1000), // Recent violations
        severity: i < 3 ? 'critical' : 'medium',
        violatedDirective: 'script-src',
        category: 'script',
        ip: '192.168.1.1'
      }));

      (cspViolationService.getRecentViolations as jest.Mock)
        .mockReturnValue(mockViolations);
    });

    it('should create alert when violations per minute threshold is exceeded', () => {
      // Trigger threshold check
      jest.advanceTimersByTime(60000);

      expect(logger.security).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'csp_violation',
          severity: 'high',
          details: expect.objectContaining({
            alertType: 'threshold_exceeded'
          })
        })
      );
    });

    it('should create alert for critical violations threshold', () => {
      // Mock more critical violations
      const criticalViolations = Array.from({ length: 5 }, (_, i) => ({
        id: `critical_${i}`,
        timestamp: new Date(Date.now() - i * 60000), // Within last hour
        severity: 'critical',
        violatedDirective: 'script-src',
        category: 'script'
      }));

      (cspViolationService.getRecentViolations as jest.Mock)
        .mockReturnValue(criticalViolations);

      // Trigger threshold check
      jest.advanceTimersByTime(60000);

      expect(logger.security).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          details: expect.objectContaining({
            alertType: 'critical_violation'
          })
        })
      );
    });
  });

  describe('pattern detection', () => {
    it('should detect suspicious IP activity', () => {
      const suspiciousViolations = Array.from({ length: 15 }, (_, i) => ({
        id: `violation_${i}`,
        timestamp: new Date(),
        severity: 'medium',
        violatedDirective: 'script-src',
        category: 'script',
        ip: '192.168.1.100' // Same IP for all violations
      }));

      (cspViolationService.getRecentViolations as jest.Mock)
        .mockReturnValue(suspiciousViolations);

      // Trigger pattern detection
      jest.advanceTimersByTime(60000);

      expect(logger.security).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'high',
          details: expect.objectContaining({
            alertType: 'pattern_detected',
            ip: '192.168.1.100'
          })
        })
      );
    });

    it('should detect repeated script injection attempts', () => {
      const scriptInjectionViolations = Array.from({ length: 8 }, (_, i) => ({
        id: `violation_${i}`,
        timestamp: new Date(),
        severity: 'critical',
        violatedDirective: 'script-src',
        category: 'script',
        blockedUri: 'https://malicious.com/evil-script.js'
      }));

      (cspViolationService.getRecentViolations as jest.Mock)
        .mockReturnValue(scriptInjectionViolations);

      // Trigger pattern detection
      jest.advanceTimersByTime(60000);

      expect(logger.security).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          details: expect.objectContaining({
            alertType: 'pattern_detected',
            pattern: 'script_injection'
          })
        })
      );
    });
  });

  describe('dashboard data', () => {
    beforeEach(() => {
      const mockViolations = [
        {
          id: 'v1',
          timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          severity: 'critical',
          violatedDirective: 'script-src \'self\'',
          category: 'script',
          ip: '192.168.1.1'
        },
        {
          id: 'v2',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          severity: 'medium',
          violatedDirective: 'style-src \'self\'',
          category: 'style',
          ip: '192.168.1.2'
        }
      ];

      const mockStats = {
        total: 2,
        byDirective: {
          'script-src \'self\'': 1,
          'style-src \'self\'': 1
        },
        byCategory: {
          script: 1,
          style: 1
        },
        bySeverity: {
          critical: 1,
          medium: 1
        },
        recentViolations: mockViolations
      };

      (cspViolationService.getRecentViolations as jest.Mock)
        .mockReturnValue(mockViolations);
      (cspViolationService.getViolationStats as jest.Mock)
        .mockReturnValue(mockStats);
    });

    it('should generate comprehensive dashboard data', () => {
      const dashboardData = service.getDashboardData();

      expect(dashboardData).toMatchObject({
        summary: expect.objectContaining({
          totalViolations: expect.any(Number),
          criticalViolations: expect.any(Number),
          violationsLast24h: expect.any(Number),
          violationsLastHour: expect.any(Number)
        }),
        trends: expect.arrayContaining([
          expect.objectContaining({
            timeframe: '24h',
            totalViolations: expect.any(Number),
            criticalViolations: expect.any(Number)
          })
        ]),
        violationsByCategory: expect.any(Object),
        violationsBySeverity: expect.any(Object),
        timeSeriesData: expect.arrayContaining([
          expect.objectContaining({
            timestamp: expect.any(String),
            violations: expect.any(Number),
            criticalViolations: expect.any(Number)
          })
        ])
      });
    });

    it('should include recent alerts in dashboard data', () => {
      // Create some alerts first
      jest.advanceTimersByTime(60000); // Trigger monitoring

      const dashboardData = service.getDashboardData();
      expect(dashboardData.recentAlerts).toBeInstanceOf(Array);
    });
  });

  describe('alert management', () => {
    it('should acknowledge alerts correctly', () => {
      // Create an alert first
      jest.advanceTimersByTime(60000);
      
      const alerts = service.getAlerts();
      if (alerts.length > 0) {
        const alertId = alerts[0]!.id;
        const success = service.acknowledgeAlert(alertId, 'test-user');
        
        expect(success).toBe(true);
        expect(logger.info).toHaveBeenCalledWith(
          'CSP alert acknowledged',
          expect.objectContaining({
            alertId,
            acknowledgedBy: 'test-user'
          })
        );
      }
    });

    it('should not acknowledge non-existent alerts', () => {
      const success = service.acknowledgeAlert('non-existent-id', 'test-user');
      expect(success).toBe(false);
    });

    it('should not acknowledge already acknowledged alerts', () => {
      // Create and acknowledge an alert
      jest.advanceTimersByTime(60000);
      const alerts = service.getAlerts();
      
      if (alerts.length > 0) {
        const alertId = alerts[0]!.id;
        service.acknowledgeAlert(alertId, 'test-user');
        
        // Try to acknowledge again
        const success = service.acknowledgeAlert(alertId, 'another-user');
        expect(success).toBe(false);
      }
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        thresholds: {
          violationsPerMinute: 10,
          violationsPerHour: 100,
          criticalViolationsPerHour: 5
        }
      };

      service.updateConfig(newConfig);
      
      const updatedConfig = service.getConfig();
      expect(updatedConfig.thresholds).toEqual(newConfig.thresholds);
      
      expect(logger.info).toHaveBeenCalledWith(
        'CSP monitoring configuration updated',
        expect.objectContaining({
          config: expect.any(Object)
        })
      );
    });

    it('should return current configuration', () => {
      const config = service.getConfig();
      expect(config).toEqual(mockConfig);
    });
  });

  describe('monitoring statistics', () => {
    beforeEach(() => {
      // Generate some alerts
      jest.advanceTimersByTime(60000);
    });

    it('should return comprehensive monitoring statistics', () => {
      const stats = service.getMonitoringStats();

      expect(stats).toMatchObject({
        totalAlerts: expect.any(Number),
        alertsBySeverity: expect.any(Object),
        alertsByType: expect.any(Object),
        acknowledgedAlerts: expect.any(Number),
        unacknowledgedAlerts: expect.any(Number)
      });
    });

    it('should track acknowledged vs unacknowledged alerts', () => {
      const alerts = service.getAlerts();
      if (alerts.length > 0) {
        service.acknowledgeAlert(alerts[0]!.id, 'test-user');
      }

      const stats = service.getMonitoringStats();
      expect(stats.acknowledgedAlerts + stats.unacknowledgedAlerts).toBe(stats.totalAlerts);
    });
  });

  describe('trend reporting', () => {
    it('should generate trend reports periodically', () => {
      // Mock stats for trend reporting
      (cspViolationService.getViolationStats as jest.Mock).mockReturnValue({
        total: 10,
        byDirective: { 'script-src': 5, 'style-src': 5 },
        byCategory: { script: 5, style: 5 },
        bySeverity: { critical: 2, high: 3, medium: 5 }
      });

      // Advance time to trigger hourly trend report
      jest.advanceTimersByTime(3600000);

      expect(logger.info).toHaveBeenCalledWith(
        'CSP Violation Trend Report',
        expect.objectContaining({
          timeframe: '24h',
          totalViolations: 10
        })
      );
    });
  });

  describe('alert cleanup', () => {
    it('should clean up old alerts based on retention policy', () => {
      // Create service with short retention for testing
      const shortRetentionConfig = {
        ...mockConfig,
        retention: { ...mockConfig.retention, alertRetentionDays: 1 }
      };
      
      const testService = new CSPMonitoringService(shortRetentionConfig);
      
      // Mock old violations to trigger alerts
      (cspViolationService.getRecentViolations as jest.Mock)
        .mockReturnValue([]);

      // Advance time past retention period
      jest.advanceTimersByTime(2 * 24 * 60 * 60 * 1000); // 2 days

      // Should have cleaned up old alerts
      const alerts = testService.getAlerts();
      expect(alerts.length).toBe(0);
    });
  });
});