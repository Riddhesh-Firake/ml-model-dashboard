import { ModelMetadata, CreateModelRequest, UpdateModelRequest } from '../../models';

export interface IModelManagementService {
  createModel(request: CreateModelRequest): Promise<ModelMetadata>;
  getModel(modelId: string): Promise<ModelMetadata | null>;
  getUserModels(userId: string): Promise<ModelMetadata[]>;
  updateModel(modelId: string, request: UpdateModelRequest): Promise<ModelMetadata>;
  deleteModel(modelId: string): Promise<void>;
  incrementRequestCount(modelId: string): Promise<void>;
  updateLastUsed(modelId: string): Promise<void>;
  getModelUsageStats(modelId: string): Promise<{
    totalRequests: number;
    lastUsed: Date;
    averageResponseTime: number;
  }>;
}