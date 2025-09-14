import { cspViolationService, ProcessedViolation } from './csp-violation.service';
import { logger } from '../monitoring/logger.service';

export interface ViolationAlert {
  id: string;
  timestamp: Date;
  type: 'threshold_exceeded' | 'critical_violation' | 'pattern_detected' | 'rate_spike';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface MonitoringConfig {
  thresholds: {
    violationsPerMinute: number;
    violationsPerHour: number;
    criticalViolationsPerHour: number;
  };
  alerting: {
    enabled: boolean;
    emailNotifications: boolean;
    webhookUrl?: string;
    slackWebhook?: string;
  };
  retention: {
    alertRetentionDays: number;
    violationRetentionDays: number;
  };
}

export interface ViolationTrend {
  timeframe: string;
  totalViolations: number;
  criticalViolations: number;
  topDirectives: Array<{ directive: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
  averagePerHour: number;
}

export interface DashboardData {
  summary: {
    totalViolations: number;
    criticalViolations: number;
    violationsLast24h: number;
    violationsLastHour: number;
    topViolatedDirective: string;
    mostActiveSource: string;
  };
  trends: ViolationTrend[];
  recentAlerts: ViolationAlert[];
  topViolations: ProcessedViolation[];
  violationsByCategory: Record<string, number>;
  violationsBySeverity: Record<string, number>;
  timeSeriesData: Array<{
    timestamp: string;
    violations: number;
    criticalViolations: number;
  }>;
}

export class CSPMonitoringService {
  private alerts: ViolationAlert[] = [];
  private config: MonitoringConfig;
  private violationCounts: Map<string, number> = new Map(); // Track violations per minute
  private lastAlertCheck: Date = new Date();

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.startMonitoring();
  }

  /**
   * Start the monitoring process
   */
  private startMonitoring(): void {
    // Check for violations and generate alerts every minute
    setInterval(() => {
      this.checkViolationThresholds();
      this.detectSuspiciousPatterns();
      this.cleanupOldAlerts();
    }, 60000); // Every minute

    // Generate trend reports every hour
    setInterval(() => {
      this.generateTrendReport();
    }, 3600000); // Every hour
  }

  /**
   * Check if violation thresholds are exceeded
   */
  private checkViolationThresholds(): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // Get recent violations
    const recentViolations = cspViolationService.getRecentViolations(1000)
      .filter(v => v.timestamp >= oneMinuteAgo);

    const hourlyViolations = cspViolationService.getRecentViolations(10000)
      .filter(v => v.timestamp >= oneHourAgo);

    const criticalHourlyViolations = hourlyViolations
      .filter(v => v.severity === 'critical');

    // Check thresholds
    if (recentViolations.length > this.config.thresholds.violationsPerMinute) {
      this.createAlert({
        type: 'threshold_exceeded',
        severity: 'high',
        message: `Violation rate exceeded: ${recentViolations.length} violations in the last minute`,
        details: {
          threshold: this.config.thresholds.violationsPerMinute,
          actual: recentViolations.length,
          timeframe: 'minute'
        }
      });
    }

    if (hourlyViolations.length > this.config.thresholds.violationsPerHour) {
      this.createAlert({
        type: 'threshold_exceeded',
        severity: 'medium',
        message: `Hourly violation threshold exceeded: ${hourlyViolations.length} violations`,
        details: {
          threshold: this.config.thresholds.violationsPerHour,
          actual: hourlyViolations.length,
          timeframe: 'hour'
        }
      });
    }

    if (criticalHourlyViolations.length > this.config.thresholds.criticalViolationsPerHour) {
      this.createAlert({
        type: 'critical_violation',
        severity: 'critical',
        message: `Critical violation threshold exceeded: ${criticalHourlyViolations.length} critical violations`,
        details: {
          threshold: this.config.thresholds.criticalViolationsPerHour,
          actual: criticalHourlyViolations.length,
          timeframe: 'hour',
          violations: criticalHourlyViolations.slice(0, 5) // Include first 5 for analysis
        }
      });
    }
  }

  /**
   * Detect suspicious patterns in violations
   */
  private detectSuspiciousPatterns(): void {
    const recentViolations = cspViolationService.getRecentViolations(100);
    
    // Group by source IP
    const violationsByIP = new Map<string, ProcessedViolation[]>();
    recentViolations.forEach(violation => {
      if (violation.ip) {
        const existing = violationsByIP.get(violation.ip) || [];
        existing.push(violation);
        violationsByIP.set(violation.ip, existing);
      }
    });

    // Check for suspicious IP activity
    violationsByIP.forEach((violations, ip) => {
      if (violations.length > 10) { // More than 10 violations from same IP
        this.createAlert({
          type: 'pattern_detected',
          severity: 'high',
          message: `Suspicious activity detected from IP ${ip}: ${violations.length} violations`,
          details: {
            ip,
            violationCount: violations.length,
            timeframe: 'recent',
            violationTypes: [...new Set(violations.map(v => v.violatedDirective))]
          }
        });
      }
    });

    // Check for repeated blocked URIs (potential attack patterns)
    const blockedUris = new Map<string, number>();
    recentViolations.forEach(violation => {
      if (violation.blockedUri) {
        blockedUris.set(violation.blockedUri, (blockedUris.get(violation.blockedUri) || 0) + 1);
      }
    });

    blockedUris.forEach((count, uri) => {
      if (count > 5 && uri.includes('script')) { // Repeated script violations
        this.createAlert({
          type: 'pattern_detected',
          severity: 'critical',
          message: `Repeated script injection attempts detected: ${uri}`,
          details: {
            blockedUri: uri,
            attemptCount: count,
            pattern: 'script_injection'
          }
        });
      }
    });
  }

  /**
   * Create a new alert
   */
  private createAlert(alertData: Omit<ViolationAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: ViolationAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.push(alert);

    // Log the alert
    logger.security({
      type: 'csp_violation',
      severity: alert.severity,
      details: {
        alertId: alert.id,
        alertType: alert.type,
        message: alert.message,
        ...alert.details
      }
    });

    // Send notifications if enabled
    if (this.config.alerting.enabled) {
      this.sendAlertNotifications(alert);
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: ViolationAlert): Promise<void> {
    try {
      // Email notifications
      if (this.config.alerting.emailNotifications) {
        // In a real implementation, you would integrate with an email service
        logger.info('Email alert notification would be sent', {
          alertId: alert.id,
          severity: alert.severity,
          message: alert.message
        });
      }

      // Webhook notifications
      if (this.config.alerting.webhookUrl) {
        // In a real implementation, you would make HTTP requests to the webhook
        logger.info('Webhook alert notification would be sent', {
          alertId: alert.id,
          webhookUrl: this.config.alerting.webhookUrl,
          payload: {
            alert: {
              id: alert.id,
              type: alert.type,
              severity: alert.severity,
              message: alert.message,
              timestamp: alert.timestamp
            }
          }
        });
      }

      // Slack notifications
      if (this.config.alerting.slackWebhook) {
        // In a real implementation, you would send to Slack webhook
        logger.info('Slack alert notification would be sent', {
          alertId: alert.id,
          slackWebhook: this.config.alerting.slackWebhook,
          message: `🚨 CSP Alert: ${alert.message}`
        });
      }
    } catch (error) {
      logger.error('Failed to send alert notifications', error instanceof Error ? error : new Error(String(error)), {
        alertId: alert.id
      });
    }
  }

  /**
   * Generate trend report
   */
  private generateTrendReport(): void {
    const now = new Date();
    const stats = cspViolationService.getViolationStats({
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: now
    });

    logger.info('CSP Violation Trend Report', {
      timeframe: '24h',
      totalViolations: stats.total,
      byDirective: stats.byDirective,
      byCategory: stats.byCategory,
      bySeverity: stats.bySeverity
    });
  }

  /**
   * Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retention.alertRetentionDays);

    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoffDate);
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get dashboard data
   */
  public getDashboardData(): DashboardData {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const allViolations = cspViolationService.getRecentViolations(10000);
    const violations24h = allViolations.filter(v => v.timestamp >= last24h);
    const violationsLastHour = allViolations.filter(v => v.timestamp >= lastHour);
    const criticalViolations = allViolations.filter(v => v.severity === 'critical');

    // Calculate top violated directive
    const directiveCounts = new Map<string, number>();
    allViolations.forEach(v => {
      directiveCounts.set(v.violatedDirective, (directiveCounts.get(v.violatedDirective) || 0) + 1);
    });
    const topViolatedDirective = Array.from(directiveCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    // Calculate most active source
    const sourceCounts = new Map<string, number>();
    allViolations.forEach(v => {
      if (v.ip) {
        sourceCounts.set(v.ip, (sourceCounts.get(v.ip) || 0) + 1);
      }
    });
    const mostActiveSource = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    // Generate time series data (hourly buckets for last 24h)
    const timeSeriesData = [];
    for (let i = 23; i >= 0; i--) {
      const bucketStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const bucketEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
      
      const bucketViolations = allViolations.filter(v => 
        v.timestamp >= bucketStart && v.timestamp < bucketEnd
      );
      
      const bucketCritical = bucketViolations.filter(v => v.severity === 'critical');

      timeSeriesData.push({
        timestamp: bucketStart.toISOString(),
        violations: bucketViolations.length,
        criticalViolations: bucketCritical.length
      });
    }

    const stats = cspViolationService.getViolationStats();

    return {
      summary: {
        totalViolations: allViolations.length,
        criticalViolations: criticalViolations.length,
        violationsLast24h: violations24h.length,
        violationsLastHour: violationsLastHour.length,
        topViolatedDirective,
        mostActiveSource
      },
      trends: [{
        timeframe: '24h',
        totalViolations: violations24h.length,
        criticalViolations: violations24h.filter(v => v.severity === 'critical').length,
        topDirectives: Object.entries(stats.byDirective)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([directive, count]) => ({ directive, count })),
        topSources: Array.from(sourceCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([source, count]) => ({ source, count })),
        averagePerHour: violations24h.length / 24
      }],
      recentAlerts: this.alerts
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10),
      topViolations: allViolations
        .filter(v => v.severity === 'critical' || v.severity === 'high')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20),
      violationsByCategory: stats.byCategory,
      violationsBySeverity: stats.bySeverity,
      timeSeriesData
    };
  }

  /**
   * Get alerts
   */
  public getAlerts(limit: number = 50): ViolationAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      
      logger.info('CSP alert acknowledged', {
        alertId,
        acknowledgedBy,
        alertType: alert.type,
        severity: alert.severity
      });
      
      return true;
    }
    return false;
  }

  /**
   * Update monitoring configuration
   */
  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('CSP monitoring configuration updated', {
      config: this.config
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStats(): {
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByType: Record<string, number>;
    acknowledgedAlerts: number;
    unacknowledgedAlerts: number;
  } {
    const alertsBySeverity: Record<string, number> = {};
    const alertsByType: Record<string, number> = {};
    let acknowledgedAlerts = 0;

    this.alerts.forEach(alert => {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
      if (alert.acknowledged) {
        acknowledgedAlerts++;
      }
    });

    return {
      totalAlerts: this.alerts.length,
      alertsBySeverity,
      alertsByType,
      acknowledgedAlerts,
      unacknowledgedAlerts: this.alerts.length - acknowledgedAlerts
    };
  }
}

// Default monitoring configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  thresholds: {
    violationsPerMinute: 10,
    violationsPerHour: 100,
    criticalViolationsPerHour: 5
  },
  alerting: {
    enabled: true,
    emailNotifications: false, // Disabled by default
    webhookUrl: process.env.CSP_WEBHOOK_URL,
    slackWebhook: process.env.CSP_SLACK_WEBHOOK
  },
  retention: {
    alertRetentionDays: 30,
    violationRetentionDays: 90
  }
};

// Export singleton instance
export const cspMonitoringService = new CSPMonitoringService(defaultMonitoringConfig);