export interface PredictionRequest {
  modelId: string;
  inputData: any;
  apiKey?: string;
}

export interface PredictionResponse {
  predictions: any;
  confidence?: number;
  processingTime: number;
  status: 'success' | 'error';
  error?: string;
}

export interface EndpointConfig {
  id: string;
  modelId: string;
  url: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  rateLimits: RateLimitConfig;
  authRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}