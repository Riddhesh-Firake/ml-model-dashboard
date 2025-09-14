import { ModelStatus } from './constants';

export enum ModelFormat {
  PICKLE = 'pkl',
  JOBLIB = 'joblib',
  KERAS = 'h5',
  ONNX = 'onnx',
  PYTORCH = 'pt',
  PYTORCH_STATE = 'pth'
}

export interface ModelMetadata {
  id: string;
  name: string;
  description: string;
  userId: string;
  fileFormat: ModelFormat;
  filePath: string;
  endpointUrl: string;
  createdAt: Date;
  lastUsed: Date;
  requestCount: number;
  status: ModelStatus;
}

export interface StoredModel {
  id: string;
  originalName: string;
  storagePath: string;
  fileSize: number;
  checksum: string;
  encryptionKey: string;
  format: ModelFormat;
}

export interface CreateModelRequest {
  name: string;
  description: string;
  userId: string;
}

export interface UpdateModelRequest {
  name?: string;
  description?: string;
  status?: ModelStatus;
  lastUsed?: Date;
}