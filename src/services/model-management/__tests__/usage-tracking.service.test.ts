import { UsageTrackingService, CreateUsageMetricRequest } from '../usage-tracking.service';
import { DatabaseConnection } from '../../../database/connection';
import { ValidationError } from '../../../models/error.model';

// Mock the database connection
jest.mock('../../../database/connection');

describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    } as any;
    service = new UsageTrackingService(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordUsage', () => {
    const validRequest: CreateUsageMetricRequest = {
      modelId: 'model-123',
      responseTime: 150,
      inputSize: 1024,
      outputSize: 512,
      success: true,
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1'
    };

    it('should record usage successfully', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.recordUsage(validRequest);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO model_usage_metrics'),
        [
          'model-123',
          150,
          1024,
          512,
          true,
          null,
          'test-agent',
          '127.0.0.1'
        ]
      );
    });

    it('should handle failed requests', async () => {
      const failedRequest = {
        ...validRequest,
        success: false,
        errorMessage: 'Model failed to load'
      };
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.recordUsage(failedRequest);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO model_usage_metrics'),
        [
          'model-123',
          150,
          1024,
          512,
          false,
          'Model failed to load',
          'test-agent',
          '127.0.0.1'
        ]
      );
    });

    it('should throw ValidationError for empty model ID', async () => {
      const invalidRequest = { ...validRequest, modelId: '' };

      await expect(service.recordUsage(invalidRequest))
        .rejects.toThrow('Model ID is required');
    });

    it('should not throw error if database query fails', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.recordUsage(validRequest)).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to record usage metric:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getModelUsageStats', () => {
    const mockStatsRow = {
      total_requests: '10',
      successful_requests: '8',
      failed_requests: '2',
      avg_response_time: '125.5',
      last_used: new Date('2023-01-15'),
      requests_today: '3',
      requests_this_week: '7',
      requests_this_month: '10'
    };

    it('should return usage statistics', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockStatsRow] } as any);

      const result = await service.getModelUsageStats('model-123');

      expect(result).toEqual({
        totalRequests: 10,
        successfulRequests: 8,
        failedRequests: 2,
        averageResponseTime: 125.5,
        lastUsed: new Date('2023-01-15'),
        requestsToday: 3,
        requestsThisWeek: 7,
        requestsThisMonth: 10
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['model-123']
      );
    });

    it('should return default stats when no data exists', async () => {
      const emptyRow = {
        total_requests: '0',
        successful_requests: '0',
        failed_requests: '0',
        avg_response_time: null,
        last_used: null,
        requests_today: '0',
        requests_this_week: '0',
        requests_this_month: '0'
      };
      mockDb.query.mockResolvedValue({ rows: [emptyRow] } as any);

      const result = await service.getModelUsageStats('model-123');

      expect(result).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastUsed: new Date(0),
        requestsToday: 0,
        requestsThisWeek: 0,
        requestsThisMonth: 0
      });
    });

    it('should throw ValidationError for empty model ID', async () => {
      await expect(service.getModelUsageStats(''))
        .rejects.toThrow('Model ID is required');
    });

    it('should return default stats if database query fails', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.getModelUsageStats('model-123');

      expect(result).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastUsed: new Date(0),
        requestsToday: 0,
        requestsThisWeek: 0,
        requestsThisMonth: 0
      });
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get usage stats:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getUsageMetrics', () => {
    const mockMetricsRows = [
      {
        id: 'metric-1',
        model_id: 'model-123',
        timestamp: new Date('2023-01-15T10:00:00Z'),
        response_time: 150,
        input_size: 1024,
        output_size: 512,
        success: true,
        error_message: null,
        user_agent: 'test-agent',
        ip_address: '127.0.0.1'
      },
      {
        id: 'metric-2',
        model_id: 'model-123',
        timestamp: new Date('2023-01-15T11:00:00Z'),
        response_time: 200,
        input_size: 2048,
        output_size: 1024,
        success: false,
        error_message: 'Timeout',
        user_agent: 'test-agent-2',
        ip_address: '127.0.0.2'
      }
    ];

    it('should return usage metrics for time period', async () => {
      mockDb.query.mockResolvedValue({ rows: mockMetricsRows } as any);

      const startDate = new Date('2023-01-15T00:00:00Z');
      const endDate = new Date('2023-01-15T23:59:59Z');
      const result = await service.getUsageMetrics('model-123', startDate, endDate, 50);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'metric-1',
        modelId: 'model-123',
        timestamp: new Date('2023-01-15T10:00:00Z'),
        responseTime: 150,
        inputSize: 1024,
        outputSize: 512,
        success: true,
        errorMessage: null,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['model-123', startDate, endDate, 50]
      );
    });

    it('should throw ValidationError for empty model ID', async () => {
      const startDate = new Date();
      const endDate = new Date();

      await expect(service.getUsageMetrics('', startDate, endDate))
        .rejects.toThrow('Model ID is required');
    });

    it('should return empty array if database query fails', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const startDate = new Date();
      const endDate = new Date();
      const result = await service.getUsageMetrics('model-123', startDate, endDate);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get usage metrics:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getUserUsageStats', () => {
    const mockUserStatsRow = {
      total_models: '5',
      total_requests: '100',
      successful_requests: '85',
      failed_requests: '15',
      avg_response_time: '175.5'
    };

    it('should return user usage statistics', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockUserStatsRow] } as any);

      const result = await service.getUserUsageStats('user-123');

      expect(result).toEqual({
        totalModels: 5,
        totalRequests: 100,
        successfulRequests: 85,
        failedRequests: 15,
        averageResponseTime: 175.5
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['user-123']
      );
    });

    it('should throw ValidationError for empty user ID', async () => {
      await expect(service.getUserUsageStats(''))
        .rejects.toThrow('User ID is required');
    });

    it('should return default stats if database query fails', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.getUserUsageStats('user-123');

      expect(result).toEqual({
        totalModels: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      });
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get user usage stats:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('cleanupOldMetrics', () => {
    it('should cleanup old metrics and return count', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 25 } as any);

      const result = await service.cleanupOldMetrics(90);

      expect(result).toBe(25);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM model_usage_metrics')
      );
    });

    it('should return 0 if database query fails', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.cleanupOldMetrics(90);

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to cleanup old metrics:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});