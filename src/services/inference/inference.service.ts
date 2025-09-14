import { IInferenceService } from '../contracts/inference.contract';
import { PredictionRequest, PredictionResponse, ModelMetadata } from '../../models';
import { ModelLoaderService, LoadedModel } from './model-loader.service';
import { ModelValidatorService, ValidationResult } from './model-validator.service';

export class InferenceService implements IInferenceService {
  private modelLoader: ModelLoaderService;
  private modelValidator: ModelValidatorService;

  constructor() {
    this.modelLoader = new ModelLoaderService();
    this.modelValidator = new ModelValidatorService();
  }

  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();

    try {
      // Validate input data
      const loadedModel = this.modelLoader.getLoadedModel(request.modelId);
      if (!loadedModel) {
        return {
          predictions: null,
          processingTime: Date.now() - startTime,
          status: 'error',
          error: `Model ${request.modelId} is not loaded`
        };
      }

      // Validate input against model schema
      const inputValidation = await this.modelValidator.validateInputData(
        request.modelId,
        request.inputData,
        loadedModel.inputSchema
      );

      if (!inputValidation.isValid) {
        return {
          predictions: null,
          processingTime: Date.now() - startTime,
          status: 'error',
          error: `Input validation failed: ${inputValidation.errors.join(', ')}`
        };
      }

      // Execute prediction
      const predictions = await this.executePrediction(loadedModel, request.inputData);

      return {
        predictions,
        processingTime: Date.now() - startTime,
        status: 'success'
      };

    } catch (error) {
      return {
        predictions: null,
        processingTime: Date.now() - startTime,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown prediction error'
      };
    }
  }

  async loadModel(modelMetadata: ModelMetadata): Promise<void> {
    try {
      // Validate model before loading
      const validation = await this.modelValidator.validateModel(modelMetadata);
      if (!validation.isValid) {
        throw new Error(`Model validation failed: ${validation.errors.join(', ')}`);
      }

      // Load the model
      await this.modelLoader.loadModel(modelMetadata);
      
      console.log(`Model ${modelMetadata.id} loaded successfully`);
      
      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn(`Model ${modelMetadata.id} warnings:`, validation.warnings);
      }

    } catch (error) {
      console.error(`Failed to load model ${modelMetadata.id}:`, error);
      throw error;
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    try {
      await this.modelLoader.unloadModel(modelId);
      console.log(`Model ${modelId} unloaded successfully`);
    } catch (error) {
      console.error(`Failed to unload model ${modelId}:`, error);
      throw error;
    }
  }

  isModelLoaded(modelId: string): boolean {
    return this.modelLoader.isModelLoaded(modelId);
  }

  async validateInput(modelId: string, inputData: any): Promise<boolean> {
    try {
      const loadedModel = this.modelLoader.getLoadedModel(modelId);
      if (!loadedModel) {
        return false;
      }

      const validation = await this.modelValidator.validateInputData(
        modelId,
        inputData,
        loadedModel.inputSchema
      );

      return validation.isValid;
    } catch (error) {
      console.error(`Input validation error for model ${modelId}:`, error);
      return false;
    }
  }

  async getModelInputSchema(modelId: string): Promise<any> {
    const loadedModel = this.modelLoader.getLoadedModel(modelId);
    if (!loadedModel) {
      throw new Error(`Model ${modelId} is not loaded`);
    }

    return loadedModel.inputSchema || {
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

  // Additional utility methods
  getCacheStats() {
    return this.modelLoader.getCacheStats();
  }

  async preloadModel(modelMetadata: ModelMetadata): Promise<void> {
    if (!this.isModelLoaded(modelMetadata.id)) {
      await this.loadModel(modelMetadata);
    }
  }

  async warmupModel(modelId: string, sampleInput?: any): Promise<void> {
    if (!this.isModelLoaded(modelId)) {
      throw new Error(`Model ${modelId} is not loaded`);
    }

    // If sample input is provided, run a prediction to warm up the model
    if (sampleInput) {
      try {
        await this.predict({
          modelId,
          inputData: sampleInput
        });
        console.log(`Model ${modelId} warmed up successfully`);
      } catch (error) {
        console.warn(`Model ${modelId} warmup failed:`, error);
      }
    }
  }

  private async executePrediction(loadedModel: LoadedModel, inputData: any): Promise<any> {
    // This is where the actual prediction would happen
    // For now, we'll return a mock prediction since we don't have the ML libraries integrated yet
    
    switch (loadedModel.format) {
      case 'pkl':
      case 'joblib':
        return this.executePythonPrediction(loadedModel, inputData);
      
      case 'h5':
        return this.executeKerasPrediction(loadedModel, inputData);
      
      case 'onnx':
        return this.executeOnnxPrediction(loadedModel, inputData);
      
      case 'pt':
      case 'pth':
        return this.executePytorchPrediction(loadedModel, inputData);
      
      default:
        throw new Error(`Unsupported model format for prediction: ${loadedModel.format}`);
    }
  }

  private async executePythonPrediction(loadedModel: LoadedModel, inputData: any): Promise<any> {
    // This would execute Python-based models (scikit-learn, etc.)
    // For now, return a mock prediction
    console.log(`Executing Python prediction for model ${loadedModel.id}`);
    
    // Mock prediction - in real implementation, this would call Python subprocess or use a bridge
    return {
      prediction: [0.8, 0.2], // Mock classification probabilities
      model_type: 'python',
      timestamp: new Date().toISOString()
    };
  }

  private async executeKerasPrediction(loadedModel: LoadedModel, inputData: any): Promise<any> {
    // This would execute TensorFlow/Keras models
    console.log(`Executing Keras prediction for model ${loadedModel.id}`);
    
    // Mock prediction - in real implementation, this would use TensorFlow.js
    return {
      prediction: [[0.1, 0.7, 0.2]], // Mock multi-class probabilities
      model_type: 'keras',
      timestamp: new Date().toISOString()
    };
  }

  private async executeOnnxPrediction(loadedModel: LoadedModel, inputData: any): Promise<any> {
    // This would execute ONNX models
    console.log(`Executing ONNX prediction for model ${loadedModel.id}`);
    
    // Mock prediction - in real implementation, this would use ONNX Runtime
    return {
      prediction: [1.23, -0.45, 2.67], // Mock regression output
      model_type: 'onnx',
      timestamp: new Date().toISOString()
    };
  }

  private async executePytorchPrediction(loadedModel: LoadedModel, inputData: any): Promise<any> {
    // This would execute PyTorch models
    console.log(`Executing PyTorch prediction for model ${loadedModel.id}`);
    
    // Mock prediction - in real implementation, this would use PyTorch integration
    return {
      prediction: [0.95], // Mock binary classification
      model_type: 'pytorch',
      timestamp: new Date().toISOString()
    };
  }
}