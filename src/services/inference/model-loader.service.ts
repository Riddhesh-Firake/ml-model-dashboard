import { ModelMetadata, ModelFormat } from '../../models';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface LoadedModel {
  id: string;
  model: any;
  format: ModelFormat;
  inputSchema?: any;
  outputSchema?: any;
  loadedAt: Date;
  lastUsed: Date;
}

export interface ModelLoaderConfig {
  maxCacheSize: number;
  modelTimeout: number; // in milliseconds
}

export class ModelLoaderService {
  private loadedModels: Map<string, LoadedModel> = new Map();
  private config: ModelLoaderConfig;

  constructor(config: ModelLoaderConfig = { maxCacheSize: 10, modelTimeout: 30 * 60 * 1000 }) {
    this.config = config;
    
    // Set up periodic cleanup of unused models
    setInterval(async () => {
      await this.cleanupUnusedModels();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  async loadModel(metadata: ModelMetadata): Promise<LoadedModel> {
    // Check if model is already loaded
    const existing = this.loadedModels.get(metadata.id);
    if (existing) {
      existing.lastUsed = new Date();
      return existing;
    }

    // Check cache size and evict if necessary
    if (this.loadedModels.size >= this.config.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    // Load the model based on format
    const model = await this.loadModelByFormat(metadata);
    
    const loadedModel: LoadedModel = {
      id: metadata.id,
      model,
      format: metadata.fileFormat,
      loadedAt: new Date(),
      lastUsed: new Date()
    };

    // Extract input/output schema if possible
    try {
      loadedModel.inputSchema = await this.extractInputSchema(model, metadata.fileFormat);
      loadedModel.outputSchema = await this.extractOutputSchema(model, metadata.fileFormat);
    } catch (error) {
      console.warn(`Could not extract schema for model ${metadata.id}:`, error);
    }

    this.loadedModels.set(metadata.id, loadedModel);
    return loadedModel;
  }

  async unloadModel(modelId: string): Promise<void> {
    const model = this.loadedModels.get(modelId);
    if (model) {
      // Cleanup model resources if needed
      await this.cleanupModelResources(model);
      this.loadedModels.delete(modelId);
    }
  }

  isModelLoaded(modelId: string): boolean {
    return this.loadedModels.has(modelId);
  }

  getLoadedModel(modelId: string): LoadedModel | undefined {
    const model = this.loadedModels.get(modelId);
    if (model) {
      model.lastUsed = new Date();
    }
    return model;
  }

  getLoadedModelsCount(): number {
    return this.loadedModels.size;
  }

  getCacheStats(): { size: number; maxSize: number; models: string[] } {
    return {
      size: this.loadedModels.size,
      maxSize: this.config.maxCacheSize,
      models: Array.from(this.loadedModels.keys())
    };
  }

  private async loadModelByFormat(metadata: ModelMetadata): Promise<any> {
    const filePath = metadata.filePath;
    
    // Verify file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Model file not found: ${filePath}`);
    }

    switch (metadata.fileFormat) {
      case ModelFormat.PICKLE:
        return await this.loadPickleModel(filePath);
      
      case ModelFormat.JOBLIB:
        return await this.loadJoblibModel(filePath);
      
      case ModelFormat.KERAS:
        return await this.loadKerasModel(filePath);
      
      case ModelFormat.ONNX:
        return await this.loadOnnxModel(filePath);
      
      case ModelFormat.PYTORCH:
      case ModelFormat.PYTORCH_STATE:
        return await this.loadPytorchModel(filePath);
      
      default:
        throw new Error(`Unsupported model format: ${metadata.fileFormat}`);
    }
  }

  private async loadPickleModel(filePath: string): Promise<any> {
    // For now, we'll use a placeholder since we need Python integration
    // In a real implementation, this would use a Python subprocess or bridge
    throw new Error('Pickle model loading requires Python integration - not implemented yet');
  }

  private async loadJoblibModel(filePath: string): Promise<any> {
    // For now, we'll use a placeholder since we need Python integration
    throw new Error('Joblib model loading requires Python integration - not implemented yet');
  }

  private async loadKerasModel(filePath: string): Promise<any> {
    // For now, we'll use a placeholder since we need TensorFlow.js
    throw new Error('Keras model loading requires TensorFlow.js - not implemented yet');
  }

  private async loadOnnxModel(filePath: string): Promise<any> {
    // For now, we'll use a placeholder since we need ONNX Runtime
    throw new Error('ONNX model loading requires ONNX Runtime - not implemented yet');
  }

  private async loadPytorchModel(filePath: string): Promise<any> {
    // For now, we'll use a placeholder since we need PyTorch integration
    throw new Error('PyTorch model loading requires PyTorch integration - not implemented yet');
  }

  private async extractInputSchema(model: any, format: ModelFormat): Promise<any> {
    // This would extract input schema based on model format
    // For now, return a generic schema
    return {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Input data for prediction'
        }
      },
      required: ['data']
    };
  }

  private async extractOutputSchema(model: any, format: ModelFormat): Promise<any> {
    // This would extract output schema based on model format
    // For now, return a generic schema
    return {
      type: 'object',
      properties: {
        predictions: {
          type: 'array',
          description: 'Model predictions'
        }
      }
    };
  }

  private async cleanupModelResources(model: LoadedModel): Promise<void> {
    // Cleanup any resources associated with the model
    // This is format-specific and would be implemented based on the model type
    console.log(`Cleaning up resources for model ${model.id}`);
  }

  private evictLeastRecentlyUsed(): void {
    let oldestModel: string | null = null;
    let oldestTime = new Date();

    for (const [modelId, model] of this.loadedModels) {
      if (model.lastUsed < oldestTime) {
        oldestTime = model.lastUsed;
        oldestModel = modelId;
      }
    }

    if (oldestModel) {
      console.log(`Evicting least recently used model: ${oldestModel}`);
      this.unloadModel(oldestModel);
    }
  }

  private async cleanupUnusedModels(): Promise<void> {
    const now = new Date();
    const modelsToRemove: string[] = [];

    for (const [modelId, model] of this.loadedModels) {
      const timeSinceLastUse = now.getTime() - model.lastUsed.getTime();
      if (timeSinceLastUse > this.config.modelTimeout) {
        modelsToRemove.push(modelId);
      }
    }

    for (const modelId of modelsToRemove) {
      console.log(`Removing unused model from cache: ${modelId}`);
      await this.unloadModel(modelId);
    }
  }
}