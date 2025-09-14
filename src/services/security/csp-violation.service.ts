import { logger, SecurityEvent } from '../monitoring/logger.service';

export interface CSPViolationReport {
  'document-uri': string;
  referrer: string;
  'violated-directive': string;
  'effective-directive': string;
  'original-policy': string;
  disposition: 'enforce' | 'report';
  'blocked-uri': string;
  'line-number': number;
  'column-number': number;
  'source-file': string;
  'status-code': number;
  'script-sample': string;
}

export interface ProcessedViolation {
  id: string;
  timestamp: Date;
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  blockedUri: string;
  sourceFile: string;
  lineNumber: number;
  columnNumber: number;
  scriptSample: string;
  disposition: 'enforce' | 'report';
  userAgent?: string;
  ip?: string;
  referer?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'script' | 'style' | 'image' | 'connect' | 'font' | 'object' | 'media' | 'frame' | 'worker' | 'manifest' | 'other';
}

export interface ViolationStats {
  total: number;
  byDirective: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recentViolations: ProcessedViolation[];
}

export class CSPViolationService {
  private violations: ProcessedViolation[] = [];
  private readonly maxStoredViolations = 1000;

  /**
   * Process and validate a CSP violation report
   */
  public processViolationReport(
    report: CSPViolationReport,
    userAgent?: string,
    ip?: string,
    referer?: string
  ): ProcessedViolation {
    // Validate required fields
    this.validateViolationReport(report);

    // Create processed violation
    const processedViolation: ProcessedViolation = {
      id: this.generateViolationId(),
      timestamp: new Date(),
      documentUri: report['document-uri'],
      violatedDirective: report['violated-directive'],
      effectiveDirective: report['effective-directive'],
      blockedUri: report['blocked-uri'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      columnNumber: report['column-number'],
      scriptSample: report['script-sample'],
      disposition: report.disposition,
      userAgent,
      ip,
      referer,
      severity: this.calculateSeverity(report),
      category: this.categorizeViolation(report['violated-directive'])
    };

    // Store violation (with rotation)
    this.storeViolation(processedViolation);

    // Log security event
    this.logSecurityEvent(processedViolation);

    // Check for critical violations that need immediate attention
    if (processedViolation.severity === 'critical') {
      this.handleCriticalViolation(processedViolation);
    }

    return processedViolation;
  }

  /**
   * Validate CSP violation report structure
   */
  private validateViolationReport(report: CSPViolationReport): void {
    if (!report || typeof report !== 'object') {
      throw new Error('Invalid violation report format');
    }

    const requiredFields = ['document-uri', 'violated-directive'];
    for (const field of requiredFields) {
      if (!report[field as keyof CSPViolationReport]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate disposition
    if (report.disposition && !['enforce', 'report'].includes(report.disposition)) {
      throw new Error('Invalid disposition value');
    }
  }

  /**
   * Calculate violation severity based on various factors
   */
  private calculateSeverity(report: CSPViolationReport): 'low' | 'medium' | 'high' | 'critical' {
    const violatedDirective = report['violated-directive'];
    const blockedUri = report['blocked-uri'];
    const scriptSample = report['script-sample'];

    // Critical: Script execution attempts from external sources
    if (violatedDirective.includes('script-src') && 
        blockedUri && 
        !blockedUri.startsWith('data:') && 
        !blockedUri.includes('self')) {
      return 'critical';
    }

    // Critical: Inline script execution with suspicious content
    if (scriptSample && this.containsSuspiciousContent(scriptSample)) {
      return 'critical';
    }

    // High: Any script-src violations
    if (violatedDirective.includes('script-src')) {
      return 'high';
    }

    // Medium: Style or connect violations
    if (violatedDirective.includes('style-src') || violatedDirective.includes('connect-src')) {
      return 'medium';
    }

    // Low: Other violations (images, fonts, etc.)
    return 'low';
  }

  /**
   * Check if script sample contains suspicious content
   */
  private containsSuspiciousContent(scriptSample: string): boolean {
    const suspiciousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /document\.write/i,
      /innerHTML\s*=/i,
      /outerHTML\s*=/i,
      /javascript:/i,
      /data:text\/html/i,
      /base64/i,
      /atob\s*\(/i,
      /btoa\s*\(/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(scriptSample));
  }

  /**
   * Categorize violation by directive type
   */
  private categorizeViolation(violatedDirective: string): ProcessedViolation['category'] {
    if (violatedDirective.includes('script-src')) return 'script';
    if (violatedDirective.includes('style-src')) return 'style';
    if (violatedDirective.includes('img-src')) return 'image';
    if (violatedDirective.includes('connect-src')) return 'connect';
    if (violatedDirective.includes('font-src')) return 'font';
    if (violatedDirective.includes('object-src')) return 'object';
    if (violatedDirective.includes('media-src')) return 'media';
    if (violatedDirective.includes('frame-src')) return 'frame';
    if (violatedDirective.includes('worker-src')) return 'worker';
    if (violatedDirective.includes('manifest-src')) return 'manifest';
    return 'other';
  }

  /**
   * Store violation with rotation
   */
  private storeViolation(violation: ProcessedViolation): void {
    this.violations.push(violation);

    // Rotate old violations if we exceed the limit
    if (this.violations.length > this.maxStoredViolations) {
      this.violations = this.violations.slice(-this.maxStoredViolations);
    }
  }

  /**
   * Log security event for the violation
   */
  private logSecurityEvent(violation: ProcessedViolation): void {
    const securityEvent: SecurityEvent = {
      type: 'csp_violation' as any, // Extend SecurityEvent type
      severity: violation.severity,
      ip: violation.ip,
      userAgent: violation.userAgent,
      details: {
        violationId: violation.id,
        documentUri: violation.documentUri,
        violatedDirective: violation.violatedDirective,
        blockedUri: violation.blockedUri,
        sourceFile: violation.sourceFile,
        lineNumber: violation.lineNumber,
        columnNumber: violation.columnNumber,
        scriptSample: violation.scriptSample,
        category: violation.category,
        disposition: violation.disposition
      }
    };

    logger.security(securityEvent, {
      requestId: violation.id,
      endpoint: '/api/csp/violations'
    });
  }

  /**
   * Handle critical violations that need immediate attention
   */
  private handleCriticalViolation(violation: ProcessedViolation): void {
    // Log critical violation with high priority
    logger.error('CRITICAL CSP VIOLATION DETECTED', undefined, {
      violationId: violation.id,
      documentUri: violation.documentUri,
      violatedDirective: violation.violatedDirective,
      blockedUri: violation.blockedUri,
      scriptSample: violation.scriptSample,
      ip: violation.ip,
      userAgent: violation.userAgent
    });

    // In production, you might want to:
    // 1. Send immediate alerts to security team
    // 2. Trigger automated security responses
    // 3. Block suspicious IPs temporarily
    // 4. Escalate to incident response system
  }

  /**
   * Generate unique violation ID
   */
  private generateViolationId(): string {
    return `csp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get violation statistics
   */
  public getViolationStats(timeRange?: { start: Date; end: Date }): ViolationStats {
    let violations = this.violations;

    // Filter by time range if provided
    if (timeRange) {
      violations = violations.filter(v => 
        v.timestamp >= timeRange.start && v.timestamp <= timeRange.end
      );
    }

    const stats: ViolationStats = {
      total: violations.length,
      byDirective: {},
      byCategory: {},
      bySeverity: {},
      recentViolations: violations.slice(-10) // Last 10 violations
    };

    // Calculate statistics
    violations.forEach(violation => {
      // By directive
      const directive = violation.violatedDirective;
      stats.byDirective[directive] = (stats.byDirective[directive] || 0) + 1;

      // By category
      stats.byCategory[violation.category] = (stats.byCategory[violation.category] || 0) + 1;

      // By severity
      stats.bySeverity[violation.severity] = (stats.bySeverity[violation.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get recent violations
   */
  public getRecentViolations(limit: number = 50): ProcessedViolation[] {
    return this.violations
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get violations by severity
   */
  public getViolationsBySeverity(severity: ProcessedViolation['severity']): ProcessedViolation[] {
    return this.violations.filter(v => v.severity === severity);
  }

  /**
   * Clear stored violations (for testing or maintenance)
   */
  public clearViolations(): void {
    this.violations = [];
  }
}

// Export singleton instance
export const cspViolationService = new CSPViolationService();