import { PredictionRequest, PredictionResponse, ModelMetadata } from '../../models';

export interface IInferenceService {
  predict(request: PredictionRequest): Promise<PredictionResponse>;
  loadModel(modelMetadata: ModelMetadata): Promise<void>;
  unloadModel(modelId: string): Promise<void>;
  isModelLoaded(modelId: string): boolean;
  validateInput(modelId: string, inputData: any): Promise<boolean>;
  getModelInputSchema(modelId: string): Promise<any>;
}