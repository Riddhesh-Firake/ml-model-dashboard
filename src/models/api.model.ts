// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: ResponseMeta;
}

// Bulk operation types
export interface BulkOperationRequest {
  modelIds: string[];
  operation: 'delete' | 'archive' | 'activate';
}

export interface BulkOperationResponse {
  successful: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
}

// Model statistics types
export interface ModelStatistics {
  totalModels: number;
  activeModels: number;
  inactiveModels: number;
  archivedModels: number;
  totalRequests: number;
  averageRequestsPerModel: number;
}

export interface UserStatistics {
  totalUsers: number;
  freeUsers: number;
  premiumUsers: number;
  totalModelsUploaded: number;
  totalPredictionRequests: number;
}

// Health check types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceHealth;
    storage: ServiceHealth;
    cache?: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
}