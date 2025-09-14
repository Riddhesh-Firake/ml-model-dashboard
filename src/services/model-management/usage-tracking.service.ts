import { DatabaseConnection } from '../../database/connection';
import { ValidationError } from '../../models/error.model';

export interface UsageMetric {
  id: string;
  modelId: string;
  timestamp: Date;
  responseTime: number;
  inputSize: number;
  outputSize: number;
  success: boolean;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date;
  requestsToday: number;
  requestsThisWeek: number;
  requestsThisMonth: number;
}

export interface CreateUsageMetricRequest {
  modelId: string;
  responseTime: number;
  inputSize: number;
  outputSize: number;
  success: boolean;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class UsageTrackingService {
  constructor(private db: DatabaseConnection) {}

  /**
   * Record a usage metric for a model
   */
  async recordUsage(request: CreateUsageMetricRequest): Promise<void> {
    if (!request.modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    const query = `
      INSERT INTO model_usage_metrics (
        id, model_id, timestamp, response_time, input_size, output_size, 
        success, error_message, user_agent, ip_address
      ) VALUES (
        gen_random_uuid(), $1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8
      )
    `;

    const params = [
      request.modelId,
      request.responseTime,
      request.inputSize,
      request.outputSize,
      request.success,
      request.errorMessage || null,
      request.userAgent || null,
      request.ipAddress || null
    ];

    try {
      await this.db.query(query, params);
    } catch (error) {
      console.error('Failed to record usage metric:', error);
      // Don't throw error to avoid breaking the main request flow
    }
  }

  /**
   * Get comprehensive usage statistics for a model
   */
  async getModelUsageStats(modelId: string): Promise<UsageStats> {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    const query = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_requests,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_requests,
        COALESCE(AVG(CASE WHEN success = true THEN response_time END), 0) as avg_response_time,
        MAX(timestamp) as last_used,
        COUNT(CASE WHEN timestamp >= CURRENT_DATE THEN 1 END) as requests_today,
        COUNT(CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as requests_this_week,
        COUNT(CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as requests_this_month
      FROM model_usage_metrics 
      WHERE model_id = $1
    `;

    try {
      const result = await this.db.query(query, [modelId]);
      const row = result.rows[0];

      return {
        totalRequests: parseInt(row.total_requests) || 0,
        successfulRequests: parseInt(row.successful_requests) || 0,
        failedRequests: parseInt(row.failed_requests) || 0,
        averageResponseTime: parseFloat(row.avg_response_time) || 0,
        lastUsed: row.last_used || new Date(0),
        requestsToday: parseInt(row.requests_today) || 0,
        requestsThisWeek: parseInt(row.requests_this_week) || 0,
        requestsThisMonth: parseInt(row.requests_this_month) || 0
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      // Return default stats if query fails
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastUsed: new Date(0),
        requestsToday: 0,
        requestsThisWeek: 0,
        requestsThisMonth: 0
      };
    }
  }

  /**
   * Get usage metrics for a specific time period
   */
  async getUsageMetrics(
    modelId: string, 
    startDate: Date, 
    endDate: Date, 
    limit: number = 100
  ): Promise<UsageMetric[]> {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    const query = `
      SELECT 
        id, model_id, timestamp, response_time, input_size, output_size,
        success, error_message, user_agent, ip_address
      FROM model_usage_metrics 
      WHERE model_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
      ORDER BY timestamp DESC
      LIMIT $4
    `;

    try {
      const result = await this.db.query(query, [modelId, startDate, endDate, limit]);
      
      return result.rows.map((row: any) => ({
        id: row.id,
        modelId: row.model_id,
        timestamp: row.timestamp,
        responseTime: row.response_time,
        inputSize: row.input_size,
        outputSize: row.output_size,
        success: row.success,
        errorMessage: row.error_message,
        userAgent: row.user_agent,
        ipAddress: row.ip_address
      }));
    } catch (error) {
      console.error('Failed to get usage metrics:', error);
      return [];
    }
  }

  /**
   * Get aggregated usage statistics for all models of a user
   */
  async getUserUsageStats(userId: string): Promise<{
    totalModels: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  }> {
    if (!userId?.trim()) {
      throw new ValidationError('User ID is required');
    }

    const query = `
      SELECT 
        COUNT(DISTINCT m.id) as total_models,
        COUNT(um.*) as total_requests,
        COUNT(CASE WHEN um.success = true THEN 1 END) as successful_requests,
        COUNT(CASE WHEN um.success = false THEN 1 END) as failed_requests,
        COALESCE(AVG(CASE WHEN um.success = true THEN um.response_time END), 0) as avg_response_time
      FROM models m
      LEFT JOIN model_usage_metrics um ON m.id = um.model_id
      WHERE m.user_id = $1
    `;

    try {
      const result = await this.db.query(query, [userId]);
      const row = result.rows[0];

      return {
        totalModels: parseInt(row.total_models) || 0,
        totalRequests: parseInt(row.total_requests) || 0,
        successfulRequests: parseInt(row.successful_requests) || 0,
        failedRequests: parseInt(row.failed_requests) || 0,
        averageResponseTime: parseFloat(row.avg_response_time) || 0
      };
    } catch (error) {
      console.error('Failed to get user usage stats:', error);
      return {
        totalModels: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      };
    }
  }

  /**
   * Clean up old usage metrics (for data retention)
   */
  async cleanupOldMetrics(retentionDays: number = 90): Promise<number> {
    const query = `
      DELETE FROM model_usage_metrics 
      WHERE timestamp < CURRENT_DATE - INTERVAL '${retentionDays} days'
    `;

    try {
      const result = await this.db.query(query);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error);
      return 0;
    }
  }
}