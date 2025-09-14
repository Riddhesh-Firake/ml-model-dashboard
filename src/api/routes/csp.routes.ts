import { Router, Request, Response } from 'express';
import { CSPMiddleware, CSPViolationReport } from '../../services/security/csp.middleware';
import { cspViolationService } from '../../services/security/csp-violation.service';
import { cspMonitoringService } from '../../services/security/csp-monitoring.service';
import { cspReportingService } from '../../services/security/csp-reporting.service';

export class CSPRoutes {
  private router: Router;
  private cspMiddleware: CSPMiddleware;

  constructor(cspMiddleware: CSPMiddleware) {
    this.router = Router();
    this.cspMiddleware = cspMiddleware;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // CSP violation reporting endpoint
    this.router.post('/violations', this.handleViolationReport.bind(this));
    
    // CSP monitoring endpoints
    this.router.get('/violations/stats', this.getViolationStats.bind(this));
    this.router.get('/violations/recent', this.getRecentViolations.bind(this));
    
    // CSP monitoring dashboard and alerting endpoints
    this.router.get('/dashboard', this.getDashboard.bind(this));
    this.router.get('/alerts', this.getAlerts.bind(this));
    this.router.post('/alerts/:alertId/acknowledge', this.acknowledgeAlert.bind(this));
    this.router.get('/monitoring/stats', this.getMonitoringStats.bind(this));
    this.router.put('/monitoring/config', this.updateMonitoringConfig.bind(this));
    
    // CSP configuration endpoints (for debugging/monitoring)
    this.router.get('/config', this.getCSPConfig.bind(this));
    
    // CSP reporting and analysis endpoints
    this.router.post('/analysis', this.generateViolationAnalysis.bind(this));
    this.router.get('/analysis/history', this.getAnalysisHistory.bind(this));
    this.router.post('/reports/trending', this.generateTrendingReport.bind(this));
    this.router.get('/reports/trending', this.getTrendingReports.bind(this));
    this.router.get('/reports/daily', this.getDailyReport.bind(this));
    this.router.get('/reports/weekly', this.getWeeklyReport.bind(this));
  }

  /**
   * Handle CSP violation reports
   */
  private handleViolationReport(req: Request, res: Response): void {
    try {
      const report: CSPViolationReport = req.body;
      
      // Process violation using the dedicated service
      const processedViolation = cspViolationService.processViolationReport(
        report,
        req.get('User-Agent'),
        req.ip,
        req.get('Referer')
      );

      // Return violation ID for tracking
      res.status(204).json({ 
        violationId: processedViolation.id,
        severity: processedViolation.severity 
      });
    } catch (error) {
      console.error('Error processing CSP violation report:', error);
      
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: 'Failed to process violation report' });
      }
    }
  }

  /**
   * Get CSP violation statistics
   */
  private getViolationStats(req: Request, res: Response): void {
    try {
      // Parse time range from query parameters
      let timeRange: { start: Date; end: Date } | undefined;
      
      if (req.query.start && req.query.end) {
        timeRange = {
          start: new Date(req.query.start as string),
          end: new Date(req.query.end as string)
        };
        
        // Validate dates
        if (isNaN(timeRange.start.getTime()) || isNaN(timeRange.end.getTime())) {
          res.status(400).json({ error: 'Invalid date format' });
          return;
        }
      }

      const stats = cspViolationService.getViolationStats(timeRange);
      res.json(stats);
    } catch (error) {
      console.error('Error getting violation statistics:', error);
      res.status(500).json({ error: 'Failed to get violation statistics' });
    }
  }

  /**
   * Get recent CSP violations
   */
  private getRecentViolations(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const severity = req.query.severity as string;

      let violations;
      if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
        violations = cspViolationService.getViolationsBySeverity(severity as any);
      } else {
        violations = cspViolationService.getRecentViolations(limit);
      }

      res.json({
        violations,
        total: violations.length
      });
    } catch (error) {
      console.error('Error getting recent violations:', error);
      res.status(500).json({ error: 'Failed to get recent violations' });
    }
  }

  /**
   * Get CSP monitoring dashboard data
   */
  private getDashboard(req: Request, res: Response): void {
    try {
      const dashboardData = cspMonitoringService.getDashboardData();
      res.json(dashboardData);
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  }

  /**
   * Get CSP alerts
   */
  private getAlerts(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const alerts = cspMonitoringService.getAlerts(limit);
      
      res.json({
        alerts,
        total: alerts.length
      });
    } catch (error) {
      console.error('Error getting alerts:', error);
      res.status(500).json({ error: 'Failed to get alerts' });
    }
  }

  /**
   * Acknowledge a CSP alert
   */
  private acknowledgeAlert(req: Request, res: Response): void {
    try {
      const { alertId } = req.params;
      const { acknowledgedBy } = req.body;

      if (!acknowledgedBy) {
        res.status(400).json({ error: 'acknowledgedBy is required' });
        return;
      }

      const success = cspMonitoringService.acknowledgeAlert(alertId, acknowledgedBy);
      
      if (success) {
        res.json({ success: true, message: 'Alert acknowledged successfully' });
      } else {
        res.status(404).json({ error: 'Alert not found or already acknowledged' });
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  }

  /**
   * Get monitoring statistics
   */
  private getMonitoringStats(req: Request, res: Response): void {
    try {
      const stats = cspMonitoringService.getMonitoringStats();
      const config = cspMonitoringService.getConfig();
      
      res.json({
        stats,
        config: {
          thresholds: config.thresholds,
          alertingEnabled: config.alerting.enabled,
          retention: config.retention
        }
      });
    } catch (error) {
      console.error('Error getting monitoring stats:', error);
      res.status(500).json({ error: 'Failed to get monitoring statistics' });
    }
  }

  /**
   * Update monitoring configuration
   */
  private updateMonitoringConfig(req: Request, res: Response): void {
    try {
      const newConfig = req.body;
      
      // Validate configuration
      if (newConfig.thresholds) {
        const { violationsPerMinute, violationsPerHour, criticalViolationsPerHour } = newConfig.thresholds;
        if (violationsPerMinute && (violationsPerMinute < 1 || violationsPerMinute > 1000)) {
          res.status(400).json({ error: 'violationsPerMinute must be between 1 and 1000' });
          return;
        }
        if (violationsPerHour && (violationsPerHour < 1 || violationsPerHour > 10000)) {
          res.status(400).json({ error: 'violationsPerHour must be between 1 and 10000' });
          return;
        }
        if (criticalViolationsPerHour && (criticalViolationsPerHour < 1 || criticalViolationsPerHour > 100)) {
          res.status(400).json({ error: 'criticalViolationsPerHour must be between 1 and 100' });
          return;
        }
      }

      cspMonitoringService.updateConfig(newConfig);
      
      res.json({ 
        success: true, 
        message: 'Monitoring configuration updated successfully',
        config: cspMonitoringService.getConfig()
      });
    } catch (error) {
      console.error('Error updating monitoring config:', error);
      res.status(500).json({ error: 'Failed to update monitoring configuration' });
    }
  }

  /**
   * Get current CSP configuration (for debugging)
   */
  private getCSPConfig(req: Request, res: Response): void {
    try {
      const config = this.cspMiddleware.getConfig();
      
      // Don't expose sensitive configuration in production
      if (process.env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Configuration access not allowed in production' });
        return;
      }

      res.json({
        enabled: config.enabled,
        reportOnly: config.reportOnly,
        nonceEnabled: config.nonce.enabled,
        directives: Object.keys(config.directives)
      });
    } catch (error) {
      console.error('Error getting CSP configuration:', error);
      res.status(500).json({ error: 'Failed to get CSP configuration' });
    }
  }

  /**
   * Generate violation analysis for a specific timeframe
   */
  private async generateViolationAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { start, end, includeRecommendations = true } = req.body;

      if (!start || !end) {
        res.status(400).json({ error: 'start and end dates are required' });
        return;
      }

      const timeframe = {
        start: new Date(start),
        end: new Date(end)
      };

      // Validate dates
      if (isNaN(timeframe.start.getTime()) || isNaN(timeframe.end.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      if (timeframe.start >= timeframe.end) {
        res.status(400).json({ error: 'Start date must be before end date' });
        return;
      }

      const analysis = await cspReportingService.generateViolationAnalysis(
        timeframe,
        includeRecommendations
      );

      res.json(analysis);
    } catch (error) {
      console.error('Error generating violation analysis:', error);
      res.status(500).json({ error: 'Failed to generate violation analysis' });
    }
  }

  /**
   * Get analysis history
   */
  private getAnalysisHistory(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (limit < 1 || limit > 100) {
        res.status(400).json({ error: 'Limit must be between 1 and 100' });
        return;
      }

      const history = cspReportingService.getAnalysisHistory(limit);
      
      res.json({
        analyses: history,
        total: history.length
      });
    } catch (error) {
      console.error('Error getting analysis history:', error);
      res.status(500).json({ error: 'Failed to get analysis history' });
    }
  }

  /**
   * Generate trending report
   */
  private async generateTrendingReport(req: Request, res: Response): Promise<void> {
    try {
      const { period, start, end } = req.body;

      if (!period || !['hourly', 'daily', 'weekly', 'monthly'].includes(period)) {
        res.status(400).json({ error: 'Valid period is required (hourly, daily, weekly, monthly)' });
        return;
      }

      if (!start || !end) {
        res.status(400).json({ error: 'start and end dates are required' });
        return;
      }

      const timeframe = {
        start: new Date(start),
        end: new Date(end)
      };

      // Validate dates
      if (isNaN(timeframe.start.getTime()) || isNaN(timeframe.end.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      if (timeframe.start >= timeframe.end) {
        res.status(400).json({ error: 'Start date must be before end date' });
        return;
      }

      const report = await cspReportingService.generateTrendingReport(period, timeframe);

      res.json(report);
    } catch (error) {
      console.error('Error generating trending report:', error);
      res.status(500).json({ error: 'Failed to generate trending report' });
    }
  }

  /**
   * Get trending reports history
   */
  private getTrendingReports(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (limit < 1 || limit > 100) {
        res.status(400).json({ error: 'Limit must be between 1 and 100' });
        return;
      }

      const reports = cspReportingService.getTrendingReports(limit);
      
      res.json({
        reports,
        total: reports.length
      });
    } catch (error) {
      console.error('Error getting trending reports:', error);
      res.status(500).json({ error: 'Failed to get trending reports' });
    }
  }

  /**
   * Generate daily report for last 24 hours
   */
  private async getDailyReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await cspReportingService.generateDailyReport();
      res.json(report);
    } catch (error) {
      console.error('Error generating daily report:', error);
      res.status(500).json({ error: 'Failed to generate daily report' });
    }
  }

  /**
   * Generate weekly report for last 7 days
   */
  private async getWeeklyReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await cspReportingService.generateWeeklyReport();
      res.json(report);
    } catch (error) {
      console.error('Error generating weekly report:', error);
      res.status(500).json({ error: 'Failed to generate weekly report' });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}