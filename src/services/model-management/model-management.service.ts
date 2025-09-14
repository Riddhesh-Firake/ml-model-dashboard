import { ModelRepository } from '../../database/repositories/model.repository';
import { DatabaseConnection } from '../../database/connection';
import { IModelManagementService } from '../contracts/model-management.contract';
import { ModelMetadata, CreateModelRequest, UpdateModelRequest } from '../../models/model.model';
import { ValidationError, NotFoundError } from '../../models/error.model';
import { ModelStatus } from '../../models/constants';
import { UsageTrackingService } from './usage-tracking.service';

export class ModelManagementService implements IModelManagementService {
  private modelRepository: ModelRepository;
  private usageTrackingService: UsageTrackingService;

  constructor(db: DatabaseConnection) {
    this.modelRepository = new ModelRepository(db);
    this.usageTrackingService = new UsageTrackingService(db);
  }

  async createModel(request: CreateModelRequest): Promise<ModelMetadata> {
    // Validate required fields
    if (!request.name?.trim()) {
      throw new ValidationError('Model name is required');
    }
    if (!request.userId?.trim()) {
      throw new ValidationError('User ID is required');
    }

    // This method is typically called by the upload service after file processing
    // For now, we'll throw an error as this should be handled by the upload flow
    throw new Error('Model creation should be handled through the upload service');
  }

  async getModel(modelId: string): Promise<ModelMetadata | null> {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    return await this.modelRepository.findById(modelId);
  }

  async getUserModels(userId: string): Promise<ModelMetadata[]> {
    if (!userId?.trim()) {
      throw new ValidationError('User ID is required');
    }

    return await this.modelRepository.findByUserId(userId);
  }

  async updateModel(modelId: string, request: UpdateModelRequest): Promise<ModelMetadata> {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    // Validate update fields
    if (request.name !== undefined && !request.name.trim()) {
      throw new ValidationError('Model name cannot be empty');
    }

    // Check if model exists
    const existingModel = await this.modelRepository.findById(modelId);
    if (!existingModel) {
      throw new NotFoundError(`Model with ID ${modelId} not found`);
    }

    return await this.modelRepository.update(modelId, request);
  }

  async deleteModel(modelId: string): Promise<void> {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    // Check if model exists
    const existingModel = await this.modelRepository.findById(modelId);
    if (!existingModel) {
      throw new NotFoundError(`Model with ID ${modelId} not found`);
    }

    // Soft delete by updating status to 'deleted'
    await this.modelRepository.update(modelId, { status: ModelStatus.DELETED });
  }

  async incrementRequestCount(modelId: string): Promise<void> {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    await this.modelRepository.incrementRequestCount(modelId);
  }

  async updateLastUsed(modelId: string): Promise<void> {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    await this.modelRepository.update(modelId, { lastUsed: new Date() });
  }

  async getModelUsageStats(modelId: string): Promise<{
    totalRequests: number;
    lastUsed: Date;
    averageResponseTime: number;
  }> {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    const model = await this.modelRepository.findById(modelId);
    if (!model) {
      throw new NotFoundError(`Model with ID ${modelId} not found`);
    }

    // Get comprehensive usage stats from the usage tracking service
    const usageStats = await this.usageTrackingService.getModelUsageStats(modelId);
    
    return {
      totalRequests: usageStats.totalRequests,
      lastUsed: usageStats.lastUsed,
      averageResponseTime: usageStats.averageResponseTime
    };
  }

  /**
   * Record a usage metric for a model prediction
   */
  async recordModelUsage(
    modelId: string,
    responseTime: number,
    inputSize: number,
    outputSize: number,
    success: boolean,
    errorMessage?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.usageTrackingService.recordUsage({
      modelId,
      responseTime,
      inputSize,
      outputSize,
      success,
      errorMessage,
      userAgent,
      ipAddress
    });

    // Also update the basic request count in the models table
    if (success) {
      await this.incrementRequestCount(modelId);
    }
  }

  /**
   * Get detailed usage statistics for a model
   */
  async getDetailedModelUsageStats(modelId: string) {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    const model = await this.modelRepository.findById(modelId);
    if (!model) {
      throw new NotFoundError(`Model with ID ${modelId} not found`);
    }

    return await this.usageTrackingService.getModelUsageStats(modelId);
  }

  /**
   * Get usage metrics for a specific time period
   */
  async getModelUsageMetrics(
    modelId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ) {
    if (!modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    const model = await this.modelRepository.findById(modelId);
    if (!model) {
      throw new NotFoundError(`Model with ID ${modelId} not found`);
    }

    return await this.usageTrackingService.getUsageMetrics(modelId, startDate, endDate, limit);
  }

  /**
   * Get aggregated usage statistics for all models of a user
   */
  async getUserUsageStats(userId: string) {
    if (!userId?.trim()) {
      throw new ValidationError('User ID is required');
    }

    return await this.usageTrackingService.getUserUsageStats(userId);
  }
}