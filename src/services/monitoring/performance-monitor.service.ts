import { Request, Response, NextFunction } from 'express';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from './logger.service';
import os from 'os';
import process from 'process';

// Initialize default metrics collection
collectDefaultMetrics({ register });

class PerformanceMonitorService {
  private httpRequestDuration: Histogram<string>;
  private httpRequestTotal: Counter<string>;
  private httpRequestSize: Histogram<string>;
  private httpResponseSize: Histogram<string>;
  private modelPredictionDuration: Histogram<string>;
  private modelPredictionTotal: Counter<string>;
  private activeConnections: Gauge<string>;
  private memoryUsage: Gauge<string>;
  private cpuUsage: Gauge<string>;
  private diskUsage: Gauge<string>;
  private modelLoadTime: Histogram<string>;
  private uploadProcessingTime: Histogram<string>;

  constructor() {
    this.initializeMetrics();
    this.startSystemMetricsCollection();
  }

  private initializeMetrics(): void {
    // HTTP request metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    this.httpRequestSize = new Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
    });

    this.httpResponseSize = new Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
    });

    // Model-specific metrics
    this.modelPredictionDuration = new Histogram({
      name: 'model_prediction_duration_seconds',
      help: 'Duration of model predictions in seconds',
      labelNames: ['model_id', 'model_format'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });

    this.modelPredictionTotal = new Counter({
      name: 'model_predictions_total',
      help: 'Total number of model predictions',
      labelNames: ['model_id', 'model_format', 'status']
    });

    this.modelLoadTime = new Histogram({
      name: 'model_load_duration_seconds',
      help: 'Time taken to load models in seconds',
      labelNames: ['model_id', 'model_format'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.uploadProcessingTime = new Histogram({
      name: 'upload_processing_duration_seconds',
      help: 'Time taken to process file uploads in seconds',
      labelNames: ['file_type', 'file_size_category'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
    });

    // System metrics
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections'
    });

    this.memoryUsage = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type']
    });

    this.cpuUsage = new Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage'
    });

    this.diskUsage = new Gauge({
      name: 'disk_usage_bytes',
      help: 'Disk usage in bytes',
      labelNames: ['type']
    });

    // Register all metrics
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.httpRequestTotal);
    register.registerMetric(this.httpRequestSize);
    register.registerMetric(this.httpResponseSize);
    register.registerMetric(this.modelPredictionDuration);
    register.registerMetric(this.modelPredictionTotal);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.memoryUsage);
    register.registerMetric(this.cpuUsage);
    register.registerMetric(this.diskUsage);
    register.registerMetric(this.modelLoadTime);
    register.registerMetric(this.uploadProcessingTime);
  }

  // Middleware for HTTP request monitoring
  monitorHttpRequests() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const route = this.getRoutePattern(req.route?.path || req.path);
      
      // Track request size
      const requestSize = this.getRequestSize(req);
      this.httpRequestSize.observe(
        { method: req.method, route },
        requestSize
      );

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = (chunk?: any, encoding?: any) => {
        const duration = (Date.now() - startTime) / 1000;
        const responseSize = this.getResponseSize(chunk);
        
        // Record metrics
        this.httpRequestDuration.observe(
          { method: req.method, route, status_code: res.statusCode.toString() },
          duration
        );
        
        this.httpRequestTotal.inc({
          method: req.method,
          route,
          status_code: res.statusCode.toString()
        });
        
        this.httpResponseSize.observe(
          { method: req.method, route, status_code: res.statusCode.toString() },
          responseSize
        );

        // Log slow requests
        if (duration > 5) {
          logger.warn('Slow HTTP request detected', {
            method: req.method,
            route,
            duration,
            statusCode: res.statusCode
          });
        }

        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  // Track model prediction performance
  trackModelPrediction(modelId: string, modelFormat: string, duration: number, success: boolean): void {
    this.modelPredictionDuration.observe(
      { model_id: modelId, model_format: modelFormat },
      duration / 1000
    );
    
    this.modelPredictionTotal.inc({
      model_id: modelId,
      model_format: modelFormat,
      status: success ? 'success' : 'error'
    });

    // Log performance data
    logger.logPerformance('model_prediction', duration, {
      modelId,
      modelFormat,
      success
    });
  }

  // Track model loading performance
  trackModelLoad(modelId: string, modelFormat: string, duration: number): void {
    this.modelLoadTime.observe(
      { model_id: modelId, model_format: modelFormat },
      duration / 1000
    );

    logger.logPerformance('model_load', duration, {
      modelId,
      modelFormat
    });
  }

  // Track upload processing performance
  trackUploadProcessing(fileType: string, fileSize: number, duration: number): void {
    const sizeCategory = this.getFileSizeCategory(fileSize);
    
    this.uploadProcessingTime.observe(
      { file_type: fileType, file_size_category: sizeCategory },
      duration / 1000
    );

    logger.logPerformance('upload_processing', duration, {
      fileType,
      fileSize,
      sizeCategory
    });
  }

  // Get current performance metrics
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Get performance summary
  getPerformanceSummary(): any {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      loadAverage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      platform: os.platform(),
      arch: os.arch()
    };
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  private collectSystemMetrics(): void {
    try {
      // Memory metrics
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);

      // System memory
      this.memoryUsage.set({ type: 'system_free' }, os.freemem());
      this.memoryUsage.set({ type: 'system_total' }, os.totalmem());

      // CPU usage (simplified)
      const loadAvg = os.loadavg();
      this.cpuUsage.set(loadAvg[0] * 100 / os.cpus().length);

    } catch (error) {
      logger.error('Failed to collect system metrics', error as Error);
    }
  }

  private getRoutePattern(path: string): string {
    // Normalize route patterns for better grouping
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-f0-9]{24}/g, '/:objectid');
  }

  private getRequestSize(req: Request): number {
    const contentLength = req.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  private getResponseSize(chunk: any): number {
    if (!chunk) return 0;
    if (typeof chunk === 'string') return Buffer.byteLength(chunk);
    if (Buffer.isBuffer(chunk)) return chunk.length;
    return 0;
  }

  private getFileSizeCategory(size: number): string {
    if (size < 1024 * 1024) return 'small'; // < 1MB
    if (size < 10 * 1024 * 1024) return 'medium'; // < 10MB
    if (size < 100 * 1024 * 1024) return 'large'; // < 100MB
    return 'xlarge'; // >= 100MB
  }
}

export const performanceMonitor = new PerformanceMonitorService();