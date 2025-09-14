import { ModelMetadata } from '../../models/model.model';
import { InferenceService } from '../inference';

export interface ModelDocumentation {
  modelId: string;
  name: string;
  description: string;
  endpointUrl: string;
  inputSchema: any;
  outputSchema: any;
  examples: {
    request: any;
    response: any;
  }[];
  usage: {
    curl: string;
    javascript: string;
    python: string;
  };
}

export class DocumentationService {
  constructor(private inferenceService: InferenceService) {}

  /**
   * Generate comprehensive documentation for a specific model
   */
  async generateModelDocumentation(model: ModelMetadata): Promise<ModelDocumentation> {
    try {
      // Ensure model is loaded to get schema information
      if (!this.inferenceService.isModelLoaded(model.id)) {
        await this.inferenceService.loadModel(model);
      }

      const inputSchema = await this.inferenceService.getModelInputSchema(model.id);
      const outputSchema = this.generateOutputSchema(model);
      const examples = await this.generateExamples(model, inputSchema);
      const usage = this.generateUsageExamples(model, examples[0]?.request);

      return {
        modelId: model.id,
        name: model.name,
        description: model.description || 'No description provided',
        endpointUrl: model.endpointUrl,
        inputSchema,
        outputSchema,
        examples,
        usage
      };
    } catch (error) {
      console.error(`Error generating documentation for model ${model.id}:`, error);
      throw new Error(`Failed to generate documentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple examples based on model type and input schema
   */
  private async generateExamples(model: ModelMetadata, inputSchema: any): Promise<Array<{ request: any; response: any }>> {
    const examples: Array<{ request: any; response: any }> = [];

    try {
      // Generate examples based on file format and schema
      const sampleInputs = this.generateSampleInputs(inputSchema, model.fileFormat);

      for (const sampleInput of sampleInputs) {
        try {
          // Try to get a real prediction for the example
          const predictionResult = await this.inferenceService.predict({
            modelId: model.id,
            inputData: sampleInput
          });

          if (predictionResult.status === 'success') {
            examples.push({
              request: sampleInput,
              response: {
                modelId: model.id,
                predictions: predictionResult.predictions,
                confidence: predictionResult.confidence,
                processingTime: predictionResult.processingTime,
                timestamp: new Date().toISOString()
              }
            });
          }
        } catch (error) {
          // If prediction fails, create a mock response
          examples.push({
            request: sampleInput,
            response: {
              modelId: model.id,
              predictions: this.generateMockPrediction(model.fileFormat),
              processingTime: 50,
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      // Ensure we have at least one example
      if (examples.length === 0) {
        examples.push({
          request: this.generateDefaultInput(inputSchema),
          response: {
            modelId: model.id,
            predictions: this.generateMockPrediction(model.fileFormat),
            processingTime: 50,
            timestamp: new Date().toISOString()
          }
        });
      }

      return examples.slice(0, 3); // Limit to 3 examples
    } catch (error) {
      console.error('Error generating examples:', error);
      return [{
        request: { input: 'example_value' },
        response: {
          modelId: model.id,
          predictions: ['example_output'],
          processingTime: 50,
          timestamp: new Date().toISOString()
        }
      }];
    }
  }

  /**
   * Generate sample inputs based on schema and model type
   */
  private generateSampleInputs(schema: any, fileFormat: string): any[] {
    const samples: any[] = [];

    if (!schema || !schema.properties) {
      // Generate format-specific defaults
      switch (fileFormat) {
        case 'h5':
          samples.push({
            input_data: [[1.0, 2.0, 3.0, 4.0]],
            batch_size: 1
          });
          break;
        case 'onnx':
          samples.push({
            input: [1.5, 2.3, 0.8, 1.2]
          });
          break;
        case 'pkl':
        case 'joblib':
          samples.push({
            feature1: 1.5,
            feature2: 'category_a',
            feature3: 100
          });
          break;
        case 'pt':
        case 'pth':
          samples.push({
            tensor_input: [[1.0, 2.0], [3.0, 4.0]]
          });
          break;
        default:
          samples.push({
            input: 'example_value'
          });
      }
      return samples;
    }

    // Generate samples based on schema
    const sample1: any = {};
    const sample2: any = {};

    for (const [key, prop] of Object.entries(schema.properties)) {
      const property = prop as any;
      
      switch (property.type) {
        case 'number':
          sample1[key] = property.minimum || 1.5;
          sample2[key] = property.maximum || 10.0;
          break;
        case 'integer':
          sample1[key] = property.minimum || 1;
          sample2[key] = property.maximum || 100;
          break;
        case 'string':
          if (property.enum) {
            sample1[key] = property.enum[0];
            sample2[key] = property.enum[1] || property.enum[0];
          } else {
            sample1[key] = 'example_string';
            sample2[key] = 'another_example';
          }
          break;
        case 'boolean':
          sample1[key] = true;
          sample2[key] = false;
          break;
        case 'array':
          sample1[key] = [1, 2, 3];
          sample2[key] = [4, 5, 6];
          break;
        default:
          sample1[key] = 'example_value';
          sample2[key] = 'another_value';
      }
    }

    samples.push(sample1);
    if (Object.keys(sample2).length > 0) {
      samples.push(sample2);
    }

    return samples;
  }

  /**
   * Generate default input when schema is not available
   */
  private generateDefaultInput(schema: any): any {
    if (!schema || !schema.properties) {
      return { input: 'example_value' };
    }

    const input: any = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      const property = prop as any;
      switch (property.type) {
        case 'number':
          input[key] = 1.0;
          break;
        case 'integer':
          input[key] = 1;
          break;
        case 'string':
          input[key] = property.enum ? property.enum[0] : 'example';
          break;
        case 'boolean':
          input[key] = true;
          break;
        case 'array':
          input[key] = [1, 2, 3];
          break;
        default:
          input[key] = 'example';
      }
    }

    return input;
  }

  /**
   * Generate mock prediction based on model format
   */
  private generateMockPrediction(fileFormat: string): any {
    switch (fileFormat) {
      case 'h5':
        return [[0.8, 0.2]]; // Classification probabilities
      case 'onnx':
        return [42.5]; // Regression value
      case 'pkl':
      case 'joblib':
        return ['positive']; // Classification result
      case 'pt':
      case 'pth':
        return [[0.9, 0.1]]; // PyTorch output
      default:
        return ['prediction_result'];
    }
  }

  /**
   * Generate output schema based on model format
   */
  private generateOutputSchema(model: ModelMetadata): any {
    const baseSchema = {
      type: 'object',
      properties: {
        modelId: {
          type: 'string',
          format: 'uuid',
          description: 'Model identifier'
        },
        predictions: {
          description: 'Model prediction results'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Prediction confidence score (if available)'
        },
        processingTime: {
          type: 'number',
          description: 'Processing time in milliseconds'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Response timestamp'
        }
      }
    };

    // Customize predictions schema based on model format
    switch (model.fileFormat) {
      case 'h5':
        baseSchema.properties.predictions = {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'number' }
          },
          description: 'Neural network output probabilities'
        };
        break;
      case 'onnx':
        baseSchema.properties.predictions = {
          type: 'array',
          items: { type: 'number' },
          description: 'ONNX model predictions'
        };
        break;
      case 'pkl':
      case 'joblib':
        baseSchema.properties.predictions = {
          oneOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'array', items: { type: 'number' } }
          ],
          description: 'Scikit-learn model predictions'
        };
        break;
      case 'pt':
      case 'pth':
        baseSchema.properties.predictions = {
          type: 'array',
          description: 'PyTorch model output tensors'
        };
        break;
      default:
        baseSchema.properties.predictions = {
          description: 'Model prediction results (format varies by model type)'
        };
    }

    return baseSchema;
  }

  /**
   * Generate usage examples in different programming languages
   */
  private generateUsageExamples(model: ModelMetadata, sampleInput: any): { curl: string; javascript: string; python: string } {
    const endpointUrl = model.endpointUrl;
    const inputJson = JSON.stringify(sampleInput, null, 2);

    const curl = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '${JSON.stringify(sampleInput)}'`;

    const javascript = `// Using fetch API
const response = await fetch('${endpointUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify(${inputJson})
});

const result = await response.json();
console.log(result);`;

    const python = `import requests
import json

url = "${endpointUrl}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_JWT_TOKEN"
}
data = ${inputJson.replace(/"/g, '"')}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)`;

    return { curl, javascript, python };
  }

  /**
   * Generate OpenAPI specification for a specific model
   */
  generateModelOpenAPISpec(model: ModelMetadata, documentation: ModelDocumentation): any {
    return {
      openapi: '3.0.0',
      info: {
        title: `${model.name} API`,
        version: '1.0.0',
        description: documentation.description
      },
      servers: [
        {
          url: process.env.API_BASE_URL || 'http://localhost:3000',
          description: 'API Server'
        }
      ],
      paths: {
        [`/api/predict/${model.id}`]: {
          post: {
            summary: `Make prediction with ${model.name}`,
            description: documentation.description,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: documentation.inputSchema,
                  examples: documentation.examples.reduce((acc, example, index) => {
                    acc[`example${index + 1}`] = {
                      summary: `Example ${index + 1}`,
                      value: example.request
                    };
                    return acc;
                  }, {} as any)
                }
              }
            },
            responses: {
              '200': {
                description: 'Prediction successful',
                content: {
                  'application/json': {
                    schema: documentation.outputSchema,
                    examples: documentation.examples.reduce((acc, example, index) => {
                      acc[`example${index + 1}`] = {
                        summary: `Example ${index + 1} Response`,
                        value: example.response
                      };
                      return acc;
                    }, {} as any)
                  }
                }
              },
              '400': {
                description: 'Invalid input data'
              },
              '401': {
                description: 'Authentication required'
              },
              '404': {
                description: 'Model not found'
              }
            },
            security: [
              { BearerAuth: [] },
              { ApiKeyAuth: [] }
            ]
          }
        }
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        }
      }
    };
  }
}