import { cspViolationService, ProcessedViolation } from './csp-violation.service';
import { cspMonitoringService } from './csp-monitoring.service';
import { logger } from '../monitoring/logger.service';

export interface ViolationAnalysis {
  id: string;
  timestamp: Date;
  timeframe: {
    start: Date;
    end: Date;
    duration: string;
  };
  summary: {
    totalViolations: number;
    uniqueViolations: number;
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
    lowViolations: number;
  };
  trends: {
    violationRate: number; // violations per hour
    criticalRate: number; // critical violations per hour
    growthRate: number; // percentage change from previous period
    peakHour: string;
    quietHour: string;
  };
  topViolations: {
    byDirective: Array<{ directive: string; count: number; percentage: number }>;
    bySource: Array<{ source: string; count: number; percentage: number }>;
    byCategory: Array<{ category: string; count: number; percentage: number }>;
    byUserAgent: Array<{ userAgent: string; count: number; percentage: number }>;
  };
  patterns: {
    suspiciousIPs: Array<{ ip: string; violationCount: number; riskScore: number }>;
    repeatedBlocks: Array<{ blockedUri: string; count: number; category: string }>;
    scriptInjectionAttempts: Array<{ sample: string; count: number; severity: string }>;
    anomalies: Array<{ type: string; description: string; severity: string }>;
  };
  recommendations: Array<{
    type: 'policy_adjustment' | 'security_alert' | 'investigation_needed' | 'false_positive';
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    action: string;
    details: any;
  }>;
}

export interface TrendingReport {
  id: string;
  generatedAt: Date;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  timeframe: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalViolations: number;
    averageViolationsPerPeriod: number;
    peakViolations: number;
    peakViolationsTime: Date;
    violationGrowthRate: number;
    criticalViolationRate: number;
  };
  topTrends: {
    emergingThreats: Array<{ pattern: string; growth: number; severity: string }>;
    decliningViolations: Array<{ directive: string; reduction: number }>;
    newViolationSources: Array<{ source: string; firstSeen: Date; count: number }>;
    persistentViolators: Array<{ identifier: string; violationCount: number; duration: string }>;
  };
  comparisons: {
    previousPeriod: {
      totalViolations: number;
      changePercentage: number;
      significantChanges: Array<{ metric: string; change: number; significance: string }>;
    };
    baseline: {
      averageViolations: number;
      deviationPercentage: number;
      isAnomalous: boolean;
    };
  };
  forecasting: {
    nextPeriodPrediction: number;
    confidence: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export class CSPReportingService {
  private analysisHistory: ViolationAnalysis[] = [];
  private trendingReports: TrendingReport[] = [];
  private readonly maxHistorySize = 100;

  /**
   * Generate comprehensive violation analysis
   */
  public async generateViolationAnalysis(
    timeframe: { start: Date; end: Date },
    includeRecommendations: boolean = true
  ): Promise<ViolationAnalysis> {
    const violations = this.getViolationsInTimeframe(timeframe);
    const duration = this.calculateDuration(timeframe.start, timeframe.end);

    const analysis: ViolationAnalysis = {
      id: this.generateAnalysisId(),
      timestamp: new Date(),
      timeframe: {
        ...timeframe,
        duration
      },
      summary: this.generateSummary(violations),
      trends: this.analyzeTrends(violations, timeframe),
      topViolations: this.analyzeTopViolations(violations),
      patterns: this.detectPatterns(violations),
      recommendations: includeRecommendations ? this.generateRecommendations(violations) : []
    };

    // Store analysis
    this.storeAnalysis(analysis);

    // Log analysis generation
    logger.info('CSP violation analysis generated', {
      analysisId: analysis.id,
      timeframe: analysis.timeframe,
      totalViolations: analysis.summary.totalViolations,
      criticalViolations: analysis.summary.criticalViolations
    });

    return analysis;
  }

  /**
   * Generate trending report
   */
  public async generateTrendingReport(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    timeframe: { start: Date; end: Date }
  ): Promise<TrendingReport> {
    const violations = this.getViolationsInTimeframe(timeframe);
    const previousPeriodTimeframe = this.getPreviousPeriodTimeframe(timeframe, period);
    const previousViolations = this.getViolationsInTimeframe(previousPeriodTimeframe);

    const report: TrendingReport = {
      id: this.generateReportId(),
      generatedAt: new Date(),
      period,
      timeframe,
      metrics: this.calculateTrendMetrics(violations, timeframe),
      topTrends: this.identifyTopTrends(violations, previousViolations),
      comparisons: this.generateComparisons(violations, previousViolations),
      forecasting: this.generateForecasting(violations, period)
    };

    // Store report
    this.storeTrendingReport(report);

    // Log report generation
    logger.info('CSP trending report generated', {
      reportId: report.id,
      period: report.period,
      timeframe: report.timeframe,
      totalViolations: report.metrics.totalViolations,
      growthRate: report.metrics.violationGrowthRate
    });

    return report;
  }

  /**
   * Get violations within timeframe
   */
  private getViolationsInTimeframe(timeframe: { start: Date; end: Date }): ProcessedViolation[] {
    return cspViolationService.getRecentViolations(10000)
      .filter(v => v.timestamp >= timeframe.start && v.timestamp <= timeframe.end);
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(violations: ProcessedViolation[]): ViolationAnalysis['summary'] {
    const severityCounts = violations.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count unique violations (by blocked URI + directive)
    const uniqueViolations = new Set(
      violations.map(v => `${v.blockedUri}:${v.violatedDirective}`)
    ).size;

    return {
      totalViolations: violations.length,
      uniqueViolations,
      criticalViolations: severityCounts.critical || 0,
      highViolations: severityCounts.high || 0,
      mediumViolations: severityCounts.medium || 0,
      lowViolations: severityCounts.low || 0
    };
  }

  /**
   * Analyze trends in violations
   */
  private analyzeTrends(
    violations: ProcessedViolation[], 
    timeframe: { start: Date; end: Date }
  ): ViolationAnalysis['trends'] {
    const durationHours = (timeframe.end.getTime() - timeframe.start.getTime()) / (1000 * 60 * 60);
    const violationRate = violations.length / durationHours;
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const criticalRate = criticalViolations.length / durationHours;

    // Analyze hourly distribution
    const hourlyDistribution = new Map<number, number>();
    violations.forEach(v => {
      const hour = v.timestamp.getHours();
      hourlyDistribution.set(hour, (hourlyDistribution.get(hour) || 0) + 1);
    });

    const sortedHours = Array.from(hourlyDistribution.entries()).sort((a, b) => b[1] - a[1]);
    const peakHour = sortedHours[0]?.[0]?.toString().padStart(2, '0') + ':00' || 'N/A';
    const quietHour = sortedHours[sortedHours.length - 1]?.[0]?.toString().padStart(2, '0') + ':00' || 'N/A';

    // Calculate growth rate (would need historical data for accurate calculation)
    const growthRate = 0; // Placeholder - implement with historical comparison

    return {
      violationRate,
      criticalRate,
      growthRate,
      peakHour,
      quietHour
    };
  }

  /**
   * Analyze top violations by various dimensions
   */
  private analyzeTopViolations(violations: ProcessedViolation[]): ViolationAnalysis['topViolations'] {
    const total = violations.length;

    // By directive
    const directiveCounts = new Map<string, number>();
    violations.forEach(v => {
      directiveCounts.set(v.violatedDirective, (directiveCounts.get(v.violatedDirective) || 0) + 1);
    });

    // By source IP
    const sourceCounts = new Map<string, number>();
    violations.forEach(v => {
      if (v.ip) {
        sourceCounts.set(v.ip, (sourceCounts.get(v.ip) || 0) + 1);
      }
    });

    // By category
    const categoryCounts = new Map<string, number>();
    violations.forEach(v => {
      categoryCounts.set(v.category, (categoryCounts.get(v.category) || 0) + 1);
    });

    // By user agent
    const userAgentCounts = new Map<string, number>();
    violations.forEach(v => {
      if (v.userAgent) {
        const shortUA = v.userAgent.substring(0, 50); // Truncate for grouping
        userAgentCounts.set(shortUA, (userAgentCounts.get(shortUA) || 0) + 1);
      }
    });

    const createTopList = (counts: Map<string, number>) => 
      Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({
          [counts === directiveCounts ? 'directive' : 
           counts === sourceCounts ? 'source' :
           counts === categoryCounts ? 'category' : 'userAgent']: key,
          count,
          percentage: Math.round((count / total) * 100)
        }));

    return {
      byDirective: createTopList(directiveCounts) as any,
      bySource: createTopList(sourceCounts) as any,
      byCategory: createTopList(categoryCounts) as any,
      byUserAgent: createTopList(userAgentCounts) as any
    };
  }

  /**
   * Detect suspicious patterns
   */
  private detectPatterns(violations: ProcessedViolation[]): ViolationAnalysis['patterns'] {
    // Suspicious IPs (high violation count)
    const ipCounts = new Map<string, number>();
    violations.forEach(v => {
      if (v.ip) {
        ipCounts.set(v.ip, (ipCounts.get(v.ip) || 0) + 1);
      }
    });

    const suspiciousIPs = Array.from(ipCounts.entries())
      .filter(([, count]) => count > 5)
      .map(([ip, count]) => ({
        ip,
        violationCount: count,
        riskScore: Math.min(100, count * 10) // Simple risk scoring
      }))
      .sort((a, b) => b.riskScore - a.riskScore);

    // Repeated blocked URIs
    const blockedUriCounts = new Map<string, number>();
    violations.forEach(v => {
      if (v.blockedUri) {
        blockedUriCounts.set(v.blockedUri, (blockedUriCounts.get(v.blockedUri) || 0) + 1);
      }
    });

    const repeatedBlocks = Array.from(blockedUriCounts.entries())
      .filter(([, count]) => count > 3)
      .map(([uri, count]) => ({
        blockedUri: uri,
        count,
        category: this.categorizeBlockedUri(uri)
      }))
      .sort((a, b) => b.count - a.count);

    // Script injection attempts
    const scriptSamples = new Map<string, number>();
    violations
      .filter(v => v.scriptSample && v.category === 'script')
      .forEach(v => {
        const sample = v.scriptSample.substring(0, 100); // Truncate for grouping
        scriptSamples.set(sample, (scriptSamples.get(sample) || 0) + 1);
      });

    const scriptInjectionAttempts = Array.from(scriptSamples.entries())
      .map(([sample, count]) => ({
        sample,
        count,
        severity: this.assessScriptSeverity(sample)
      }))
      .sort((a, b) => b.count - a.count);

    // Detect anomalies
    const anomalies = this.detectAnomalies(violations);

    return {
      suspiciousIPs,
      repeatedBlocks,
      scriptInjectionAttempts,
      anomalies
    };
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(violations: ProcessedViolation[]): ViolationAnalysis['recommendations'] {
    const recommendations: ViolationAnalysis['recommendations'] = [];

    // Check for high script violation rates
    const scriptViolations = violations.filter(v => v.category === 'script');
    if (scriptViolations.length > violations.length * 0.5) {
      recommendations.push({
        type: 'policy_adjustment',
        priority: 'high',
        description: 'High rate of script-src violations detected',
        action: 'Review and tighten script-src policy, ensure all legitimate scripts use nonces',
        details: {
          scriptViolationCount: scriptViolations.length,
          totalViolations: violations.length,
          percentage: Math.round((scriptViolations.length / violations.length) * 100)
        }
      });
    }

    // Check for critical violations
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push({
        type: 'security_alert',
        priority: 'critical',
        description: 'Critical CSP violations require immediate investigation',
        action: 'Investigate potential security threats and implement additional protections',
        details: {
          criticalCount: criticalViolations.length,
          samples: criticalViolations.slice(0, 3)
        }
      });
    }

    // Check for suspicious IP activity
    const ipCounts = new Map<string, number>();
    violations.forEach(v => {
      if (v.ip) {
        ipCounts.set(v.ip, (ipCounts.get(v.ip) || 0) + 1);
      }
    });

    const suspiciousIPs = Array.from(ipCounts.entries()).filter(([, count]) => count > 10);
    if (suspiciousIPs.length > 0) {
      recommendations.push({
        type: 'investigation_needed',
        priority: 'high',
        description: 'Suspicious IP addresses with high violation rates detected',
        action: 'Consider implementing rate limiting or blocking for suspicious IPs',
        details: {
          suspiciousIPs: suspiciousIPs.slice(0, 5)
        }
      });
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private calculateDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
  }

  private categorizeBlockedUri(uri: string): string {
    if (uri.includes('script') || uri.includes('.js')) return 'script';
    if (uri.includes('style') || uri.includes('.css')) return 'style';
    if (uri.includes('img') || uri.match(/\.(jpg|jpeg|png|gif|svg)$/i)) return 'image';
    if (uri.includes('font') || uri.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
    return 'other';
  }

  private assessScriptSeverity(sample: string): string {
    const suspiciousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /document\.write/i,
      /innerHTML\s*=/i,
      /javascript:/i
    ];

    const matchCount = suspiciousPatterns.filter(pattern => pattern.test(sample)).length;
    
    if (matchCount >= 3) return 'critical';
    if (matchCount >= 2) return 'high';
    if (matchCount >= 1) return 'medium';
    return 'low';
  }

  private detectAnomalies(violations: ProcessedViolation[]): Array<{ type: string; description: string; severity: string }> {
    const anomalies: Array<{ type: string; description: string; severity: string }> = [];

    // Check for unusual violation spikes
    const hourlyDistribution = new Map<number, number>();
    violations.forEach(v => {
      const hour = v.timestamp.getHours();
      hourlyDistribution.set(hour, (hourlyDistribution.get(hour) || 0) + 1);
    });

    const hourlyValues = Array.from(hourlyDistribution.values());
    const average = hourlyValues.reduce((a, b) => a + b, 0) / hourlyValues.length;
    const maxHourly = Math.max(...hourlyValues);

    if (maxHourly > average * 3) {
      anomalies.push({
        type: 'violation_spike',
        description: `Unusual spike in violations detected (${maxHourly} vs average ${Math.round(average)})`,
        severity: 'medium'
      });
    }

    return anomalies;
  }

  private calculateTrendMetrics(violations: ProcessedViolation[], timeframe: { start: Date; end: Date }): TrendingReport['metrics'] {
    const durationHours = (timeframe.end.getTime() - timeframe.start.getTime()) / (1000 * 60 * 60);
    
    // Find peak violations hour
    const hourlyDistribution = new Map<string, number>();
    violations.forEach(v => {
      const hourKey = v.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      hourlyDistribution.set(hourKey, (hourlyDistribution.get(hourKey) || 0) + 1);
    });

    const peakEntry = Array.from(hourlyDistribution.entries())
      .sort((a, b) => b[1] - a[1])[0];

    const criticalViolations = violations.filter(v => v.severity === 'critical');

    return {
      totalViolations: violations.length,
      averageViolationsPerPeriod: violations.length / durationHours,
      peakViolations: peakEntry?.[1] || 0,
      peakViolationsTime: peakEntry ? new Date(peakEntry[0] + ':00:00.000Z') : new Date(),
      violationGrowthRate: 0, // Would need historical data
      criticalViolationRate: (criticalViolations.length / violations.length) * 100
    };
  }

  private identifyTopTrends(current: ProcessedViolation[], previous: ProcessedViolation[]): TrendingReport['topTrends'] {
    // This is a simplified implementation - in practice you'd want more sophisticated trend analysis
    return {
      emergingThreats: [],
      decliningViolations: [],
      newViolationSources: [],
      persistentViolators: []
    };
  }

  private generateComparisons(current: ProcessedViolation[], previous: ProcessedViolation[]): TrendingReport['comparisons'] {
    const changePercentage = previous.length > 0 
      ? ((current.length - previous.length) / previous.length) * 100 
      : 0;

    return {
      previousPeriod: {
        totalViolations: previous.length,
        changePercentage,
        significantChanges: []
      },
      baseline: {
        averageViolations: previous.length, // Simplified
        deviationPercentage: Math.abs(changePercentage),
        isAnomalous: Math.abs(changePercentage) > 50
      }
    };
  }

  private generateForecasting(violations: ProcessedViolation[], period: string): TrendingReport['forecasting'] {
    // Simplified forecasting - in practice you'd use more sophisticated algorithms
    const recentTrend = violations.length;
    
    return {
      nextPeriodPrediction: recentTrend,
      confidence: 0.7,
      trendDirection: 'stable',
      riskLevel: recentTrend > 100 ? 'high' : recentTrend > 50 ? 'medium' : 'low'
    };
  }

  private getPreviousPeriodTimeframe(timeframe: { start: Date; end: Date }, period: string): { start: Date; end: Date } {
    const duration = timeframe.end.getTime() - timeframe.start.getTime();
    return {
      start: new Date(timeframe.start.getTime() - duration),
      end: new Date(timeframe.start.getTime())
    };
  }

  private storeAnalysis(analysis: ViolationAnalysis): void {
    this.analysisHistory.push(analysis);
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory = this.analysisHistory.slice(-this.maxHistorySize);
    }
  }

  private storeTrendingReport(report: TrendingReport): void {
    this.trendingReports.push(report);
    if (this.trendingReports.length > this.maxHistorySize) {
      this.trendingReports = this.trendingReports.slice(-this.maxHistorySize);
    }
  }

  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public API methods
   */
  public getAnalysisHistory(limit: number = 10): ViolationAnalysis[] {
    return this.analysisHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getTrendingReports(limit: number = 10): TrendingReport[] {
    return this.trendingReports
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
      .slice(0, limit);
  }

  public async generateDailyReport(): Promise<TrendingReport> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return this.generateTrendingReport('daily', {
      start: yesterday,
      end: now
    });
  }

  public async generateWeeklyReport(): Promise<TrendingReport> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return this.generateTrendingReport('weekly', {
      start: weekAgo,
      end: now
    });
  }
}

// Export singleton instance
export const cspReportingService = new CSPReportingService();