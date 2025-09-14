import { ModelMetadata, ModelFormat } from '../../models';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    fileSize: number;
    format: ModelFormat;
    estimatedMemoryUsage?: number;
  };
}

export class ModelValidatorService {
  private readonly maxFileSize = 500 * 1024 * 1024; // 500MB
  private readonly supportedFormats = Object.values(ModelFormat);

  async validateModel(metadata: ModelMetadata): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Check if file exists
      const stats = await fs.stat(metadata.filePath);
      
      result.metadata = {
        fileSize: stats.size,
        format: metadata.fileFormat
      };

      // Validate file size
      if (stats.size > this.maxFileSize) {
        result.errors.push(`File size (${this.formatBytes(stats.size)}) exceeds maximum allowed size (${this.formatBytes(this.maxFileSize)})`);
        result.isValid = false;
      }

      // Validate file format
      if (!this.supportedFormats.includes(metadata.fileFormat)) {
        result.errors.push(`Unsupported model format: ${metadata.fileFormat}`);
        result.isValid = false;
      }

      // Validate file extension matches format
      const fileExtension = path.extname(metadata.filePath).toLowerCase().substring(1);
      if (!this.isExtensionValidForFormat(fileExtension, metadata.fileFormat)) {
        result.errors.push(`File extension .${fileExtension} does not match declared format ${metadata.fileFormat}`);
        result.isValid = false;
      }

      // Format-specific validation
      await this.validateFormatSpecific(metadata, result);

      // Estimate memory usage
      result.metadata.estimatedMemoryUsage = this.estimateMemoryUsage(stats.size, metadata.fileFormat);

      // Add warnings for large models
      if (stats.size > 100 * 1024 * 1024) { // 100MB
        result.warnings.push('Large model file may impact loading performance');
      }

      if (result.metadata.estimatedMemoryUsage > 1024 * 1024 * 1024) { // 1GB
        result.warnings.push('Model may require significant memory resources');
      }

    } catch (error) {
      result.errors.push(`Failed to access model file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  async validateInputData(modelId: string, inputData: any, inputSchema?: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Basic input validation
    if (inputData === null || inputData === undefined) {
      result.errors.push('Input data is required');
      result.isValid = false;
      return result;
    }

    // If we have a schema, validate against it
    if (inputSchema) {
      const schemaValidation = this.validateAgainstSchema(inputData, inputSchema);
      result.errors.push(...schemaValidation.errors);
      result.warnings.push(...schemaValidation.warnings);
      result.isValid = result.isValid && schemaValidation.isValid;
    }

    // Generic data type validation
    if (typeof inputData === 'object' && !Array.isArray(inputData)) {
      // Check for common input formats
      if (!inputData.data && !inputData.features && !inputData.input) {
        result.warnings.push('Input data should typically contain "data", "features", or "input" field');
      }
    }

    return result;
  }

  private async validateFormatSpecific(metadata: ModelMetadata, result: ValidationResult): Promise<void> {
    switch (metadata.fileFormat) {
      case ModelFormat.PICKLE:
        await this.validatePickleModel(metadata.filePath, result);
        break;
      
      case ModelFormat.JOBLIB:
        await this.validateJoblibModel(metadata.filePath, result);
        break;
      
      case ModelFormat.KERAS:
        await this.validateKerasModel(metadata.filePath, result);
        break;
      
      case ModelFormat.ONNX:
        await this.validateOnnxModel(metadata.filePath, result);
        break;
      
      case ModelFormat.PYTORCH:
      case ModelFormat.PYTORCH_STATE:
        await this.validatePytorchModel(metadata.filePath, result);
        break;
    }
  }

  private async validatePickleModel(filePath: string, result: ValidationResult): Promise<void> {
    // Basic file header validation for pickle files
    try {
      const buffer = await fs.readFile(filePath, { encoding: null });
      const header = buffer.slice(0, 4);
      
      // Check for pickle protocol markers
      if (header[0] !== 0x80) { // Pickle protocol 2+
        result.warnings.push('File may not be a valid pickle file (missing protocol marker)');
      }
    } catch (error) {
      result.warnings.push('Could not validate pickle file format');
    }
  }

  private async validateJoblibModel(filePath: string, result: ValidationResult): Promise<void> {
    // Joblib files are typically pickle files with compression
    await this.validatePickleModel(filePath, result);
  }

  private async validateKerasModel(filePath: string, result: ValidationResult): Promise<void> {
    // H5 files have a specific header
    try {
      const buffer = await fs.readFile(filePath, { encoding: null });
      const header = buffer.slice(0, 8);
      
      // HDF5 signature
      const hdf5Signature = Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (!header.equals(hdf5Signature)) {
        result.errors.push('File is not a valid HDF5/Keras model file');
        result.isValid = false;
      }
    } catch (error) {
      result.warnings.push('Could not validate Keras model file format');
    }
  }

  private async validateOnnxModel(filePath: string, result: ValidationResult): Promise<void> {
    // ONNX files are protobuf format
    try {
      const buffer = await fs.readFile(filePath, { encoding: null });
      
      // Basic protobuf validation - check for protobuf markers
      if (buffer.length < 10) {
        result.errors.push('ONNX file appears to be too small to be valid');
        result.isValid = false;
      }
    } catch (error) {
      result.warnings.push('Could not validate ONNX model file format');
    }
  }

  private async validatePytorchModel(filePath: string, result: ValidationResult): Promise<void> {
    // PyTorch files are typically pickle-based
    try {
      const buffer = await fs.readFile(filePath, { encoding: null });
      
      // Check for ZIP signature (PyTorch uses ZIP format)
      const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      if (buffer.slice(0, 4).equals(zipSignature)) {
        // This is likely a valid PyTorch model
        return;
      }
      
      // Check for pickle signature as fallback
      if (buffer[0] === 0x80) {
        result.warnings.push('PyTorch model appears to be in pickle format (older PyTorch version)');
        return;
      }
      
      result.warnings.push('PyTorch model format could not be verified');
    } catch (error) {
      result.warnings.push('Could not validate PyTorch model file format');
    }
  }

  private validateAgainstSchema(data: any, schema: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Basic JSON schema validation
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (actualType !== schema.type) {
        result.errors.push(`Expected type ${schema.type}, got ${actualType}`);
        result.isValid = false;
      }
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in data)) {
          result.errors.push(`Required field '${requiredField}' is missing`);
          result.isValid = false;
        }
      }
    }

    return result;
  }

  private isExtensionValidForFormat(extension: string, format: ModelFormat): boolean {
    const validExtensions: Record<ModelFormat, string[]> = {
      [ModelFormat.PICKLE]: ['pkl', 'pickle'],
      [ModelFormat.JOBLIB]: ['joblib', 'pkl'],
      [ModelFormat.KERAS]: ['h5', 'hdf5'],
      [ModelFormat.ONNX]: ['onnx'],
      [ModelFormat.PYTORCH]: ['pt', 'pth'],
      [ModelFormat.PYTORCH_STATE]: ['pth', 'pt']
    };

    return validExtensions[format]?.includes(extension) || false;
  }

  private estimateMemoryUsage(fileSize: number, format: ModelFormat): number {
    // Rough estimates based on format
    const multipliers: Record<ModelFormat, number> = {
      [ModelFormat.PICKLE]: 2.5,      // Pickle files expand in memory
      [ModelFormat.JOBLIB]: 2.0,      // Compressed, less expansion
      [ModelFormat.KERAS]: 1.5,       // HDF5 is relatively efficient
      [ModelFormat.ONNX]: 1.8,        // Protobuf format
      [ModelFormat.PYTORCH]: 2.0,     // ZIP format with some overhead
      [ModelFormat.PYTORCH_STATE]: 2.0
    };

    return Math.round(fileSize * (multipliers[format] || 2.0));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}