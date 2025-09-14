import { Router } from 'express';
import { healthCheck } from '../../services/monitoring/health-check.service';
import { performanceMonitor } from '../../services/monitoring/performance-monitor.service';
import { logAnalyzer } from '../../services/monitoring/log-analyzer.service';
import { logger } from '../../services/monitoring/logger.service';

const router = Router();

/**
 * @swagger
 * /monitoring/health:
 *   get:
 *     summary: Get application health status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Application is healthy or degraded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 version:
 *                   type: string
 *                 checks:
 *                   type: object
 *       503:
 *         description: Application is unhealthy
 */
router.get('/health', healthCheck.healthEndpoint());

/**
 * @swagger
 * /monitoring/health/live:
 *   get:
 *     summary: Liveness probe
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Application is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [alive, dead]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health/live', healthCheck.livenessEndpoint());

/**
 * @swagger
 * /monitoring/health/ready:
 *   get:
 *     summary: Readiness probe
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Application is ready
 *       503:
 *         description: Application is not ready
 */
router.get('/health/ready', healthCheck.readinessEndpoint());

/**
 * @swagger
 * /monitoring/metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Prometheus metrics in text format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics', healthCheck.metricsEndpoint());

/**
 * @swagger
 * /monitoring/performance:
 *   get:
 *     summary: Get performance summary
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Performance metrics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/performance', async (req, res) => {
  try {
    const summary = performanceMonitor.getPerformanceSummary();
    const systemHealth = await healthCheck.getSystemHealth();
    
    res.json({
      performance: summary,
      system: systemHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get performance summary', error as Error);
    res.status(500).json({ error: 'Failed to retrieve performance data' });
  }
});

/**
 * @swagger
 * /monitoring/logs/analyze:
 *   get:
 *     summary: Get log analysis
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to analyze
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *         description: Log level filter
 *     responses:
 *       200:
 *         description: Log analysis results
 */
router.get('/logs/analyze', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const level = req.query.level as string;
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));
    
    const analysis = await logAnalyzer.analyzeApplicationLogs({
      startDate,
      endDate,
      level
    });
    
    res.json({
      analysis,
      period: { startDate, endDate, hours },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to analyze logs', error as Error);
    res.status(500).json({ error: 'Failed to analyze logs' });
  }
});

/**
 * @swagger
 * /monitoring/logs/errors:
 *   get:
 *     summary: Get error summary
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to analyze
 *     responses:
 *       200:
 *         description: Error summary
 */
router.get('/logs/errors', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const errorSummary = await logAnalyzer.getErrorSummary(hours);
    
    res.json({
      errors: errorSummary,
      period: { hours },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get error summary', error as Error);
    res.status(500).json({ error: 'Failed to retrieve error summary' });
  }
});

/**
 * @swagger
 * /monitoring/logs/security:
 *   get:
 *     summary: Get security events
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to analyze
 *     responses:
 *       200:
 *         description: Security events
 */
router.get('/logs/security', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));
    
    const securityEvents = await logAnalyzer.analyzeSecurityLogs({
      startDate,
      endDate
    });
    
    res.json({
      events: securityEvents,
      period: { startDate, endDate, hours },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get security events', error as Error);
    res.status(500).json({ error: 'Failed to retrieve security events' });
  }
});

/**
 * @swagger
 * /monitoring/logs/search:
 *   get:
 *     summary: Search logs
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to search
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/logs/search', async (req, res) => {
  try {
    const searchTerm = req.query.q as string;
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = parseInt(req.query.limit as string) || 100;
    
    if (!searchTerm) {
      res.status(400).json({ error: 'Search term (q) is required' });
      return;
    }
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));
    
    const results = await logAnalyzer.searchLogs(searchTerm, {
      startDate,
      endDate,
      limit
    });
    
    res.json({
      results,
      searchTerm,
      period: { startDate, endDate, hours },
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to search logs', error as Error);
    res.status(500).json({ error: 'Failed to search logs' });
  }
});

/**
 * @swagger
 * /monitoring/models/{id}/performance:
 *   get:
 *     summary: Get performance metrics for a specific model
 *     tags: [Monitoring]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Model ID
 *     responses:
 *       200:
 *         description: Model performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Model not found
 */
router.get('/models/:id/performance', async (req, res) => {
  try {
    const modelId = req.params.id;
    
    // Mock performance data for the model
    const performanceData = {
      modelId,
      metrics: {
        totalPredictions: Math.floor(Math.random() * 1000) + 100,
        averageResponseTime: Math.round((Math.random() * 200 + 50) * 100) / 100,
        successRate: Math.round((Math.random() * 10 + 90) * 100) / 100,
        errorRate: Math.round((Math.random() * 5) * 100) / 100,
        throughput: Math.round((Math.random() * 50 + 10) * 100) / 100
      },
      timeRange: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(performanceData);
  } catch (error) {
    logger.error('Failed to get model performance', error as Error);
    res.status(500).json({ error: 'Failed to retrieve model performance data' });
  }
});

/**
 * @swagger
 * /monitoring/user/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Monitoring]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/user/stats', async (req, res) => {
  try {
    // Mock user statistics with more comprehensive data
    const userStats = {
      totalModels: Math.floor(Math.random() * 10) + 1,
      totalRequests: Math.floor(Math.random() * 5000) + 1000,
      totalPredictions: Math.floor(Math.random() * 1000) + 100,
      activeModels: Math.floor(Math.random() * 5) + 1,
      avgResponseTime: Math.round((Math.random() * 200 + 50) * 100) / 100,
      successfulRequests: Math.floor(Math.random() * 4500) + 900,
      errorCount: Math.floor(Math.random() * 100) + 10,
      successRate: Math.round((Math.random() * 10 + 90) * 100) / 100,
      lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      subscription: 'free',
      rateLimits: {
        requestsPerMinute: 10,
        modelsLimit: 5,
        currentUsage: Math.floor(Math.random() * 8)
      }
    };
    
    res.json(userStats);
  } catch (error) {
    logger.error('Failed to get user stats', error as Error);
    res.status(500).json({ error: 'Failed to retrieve user statistics' });
  }
});

/**
 * @swagger
 * /monitoring/analytics/{type}:
 *   get:
 *     summary: Get analytics data by type
 *     tags: [Monitoring]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [requests, performance, errors, models]
 *         description: Analytics data type
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           default: 7d
 *         description: Time range (e.g., 7d, 24h, 30d)
 *     responses:
 *       200:
 *         description: Analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/analytics/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const range = req.query.range as string || '7d';
    
    // Parse time range
    const timeRangeMap: { [key: string]: number } = {
      '24h': 24,
      '7d': 7 * 24,
      '30d': 30 * 24
    };
    
    const hours = timeRangeMap[range] || 7 * 24;
    const dataPoints = range === '24h' ? 24 : Math.min(hours / 24, 30);
    
    // Generate mock analytics data
    const analyticsData = generateAnalyticsData(type, dataPoints, range === '24h');
    
    res.json({
      type,
      range,
      data: analyticsData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get analytics data', error as Error);
    res.status(500).json({ error: 'Failed to retrieve analytics data' });
  }
});

/**
 * Generate mock analytics data
 */
function generateAnalyticsData(type: string, dataPoints: number, isHourly: boolean = false) {
  const data = [];
  const now = new Date();
  
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timeOffset = isHourly ? i * 60 * 60 * 1000 : i * 24 * 60 * 60 * 1000;
    const timestamp = new Date(now.getTime() - timeOffset);
    
    let value;
    let additionalData = {};
    
    switch (type) {
      case 'requests':
        value = Math.floor(Math.random() * 200) + 50;
        additionalData = {
          successful: Math.floor(value * (0.9 + Math.random() * 0.1)),
          failed: Math.floor(value * Math.random() * 0.1)
        };
        break;
      case 'performance':
        value = Math.round((Math.random() * 100 + 100) * 100) / 100;
        additionalData = {
          p95: Math.round(value * 1.5 * 100) / 100,
          p99: Math.round(value * 2 * 100) / 100,
          throughput: Math.round((Math.random() * 50 + 10) * 100) / 100
        };
        break;
      case 'errors':
        value = Math.floor(Math.random() * 10) + 1;
        additionalData = {
          errorRate: Math.round((value / (value + Math.random() * 100)) * 10000) / 100,
          errorTypes: {
            validation: Math.floor(Math.random() * 3),
            timeout: Math.floor(Math.random() * 2),
            server: Math.floor(Math.random() * 2),
            auth: Math.floor(Math.random() * 1)
          }
        };
        break;
      case 'models':
        value = Math.floor(Math.random() * 50) + 10;
        additionalData = {
          activeModels: Math.floor(Math.random() * 5) + 1,
          totalModels: Math.floor(Math.random() * 10) + 3
        };
        break;
      default:
        value = Math.floor(Math.random() * 100);
    }
    
    data.push({
      timestamp: timestamp.toISOString(),
      value,
      ...additionalData,
      label: isHourly ? 
        timestamp.getHours().toString().padStart(2, '0') + ':00' :
        timestamp.toLocaleDateString('en-US', { weekday: 'short' })
    });
  }
  
  return data;
}

export default router;