import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../../services/user-management/auth.middleware';

export class PredictionRoutes {
  private router: Router;
  private authMiddleware: AuthMiddleware;

  constructor(authMiddleware: AuthMiddleware) {
    this.router = Router();
    this.authMiddleware = authMiddleware;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Simple mock prediction endpoint for now
    this.router.post('/:modelId', this.authMiddleware.authenticateAny, this.predict.bind(this));
    this.router.get('/:modelId/schema', this.authMiddleware.authenticateAny, this.getSchema.bind(this));
  }

  public getRouter(): Router {
    return this.router;
  }

  private async predict(req: Request, res: Response): Promise<void> {
    try {
      const modelId = req.params.modelId;
      const inputData = req.body;

      if (!inputData || Object.keys(inputData).length === 0) {
        res.status(400).json({
          error: {
            code: 'MISSING_INPUT_DATA',
            message: 'Input data is required for prediction',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Determine model type and make appropriate prediction
      let prediction, confidence, additionalData = {};
      
      // Check if it's a house price model (regression)
      if (inputData.bedrooms && inputData.bathrooms && inputData.sqft && inputData.age !== undefined) {
        // House price prediction (regression)
        prediction = 50000 + 
                    (inputData.bedrooms * 25000) + 
                    (inputData.bathrooms * 15000) + 
                    (inputData.sqft * 100) - 
                    (inputData.age * 1000);
        prediction = Math.round(prediction * 100) / 100;
        confidence = 0.85;
        additionalData = {
          model_type: 'regression',
          prediction_type: 'house_price',
          currency: 'USD'
        };
      }
      // Check if it's a customer churn model (classification)
      else if (inputData.age && inputData.tenure !== undefined && inputData.monthly_charges !== undefined) {
        // Customer churn prediction (classification)
        const churnScore = this.calculateChurnScore(inputData);
        const churnProbability = 1 / (1 + Math.exp(-churnScore)); // Sigmoid function
        
        prediction = churnProbability > 0.5 ? 1 : 0;
        confidence = Math.max(churnProbability, 1 - churnProbability);
        
        additionalData = {
          model_type: 'classification',
          prediction_type: 'customer_churn',
          prediction_label: prediction === 1 ? 'Churn' : 'No Churn',
          churn_probability: Math.round(churnProbability * 1000) / 1000,
          no_churn_probability: Math.round((1 - churnProbability) * 1000) / 1000,
          risk_level: churnProbability > 0.7 ? 'High' : churnProbability > 0.3 ? 'Medium' : 'Low'
        };
      }
      // Generic prediction for unknown model types
      else {
        prediction = Math.random() > 0.5 ? 1 : 0;
        confidence = 0.75;
        additionalData = {
          model_type: 'unknown',
          prediction_type: 'generic'
        };
      }

      res.json({
        modelId,
        prediction,
        confidence: Math.round(confidence * 1000) / 1000,
        processingTime: Math.random() * 100 + 50,
        timestamp: new Date().toISOString(),
        input: inputData,
        ...additionalData
      });

    } catch (error) {
      console.error('Prediction error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error during prediction',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  private calculateChurnScore(inputData: any): number {
    // Simple churn scoring algorithm
    let score = 0;
    
    // Age factor (younger customers more likely to churn)
    if (inputData.age < 30) score += 0.5;
    else if (inputData.age > 60) score -= 0.3;
    
    // Tenure factor (new customers more likely to churn)
    if (inputData.tenure < 6) score += 1.0;
    else if (inputData.tenure > 24) score -= 0.5;
    
    // Monthly charges factor (high charges increase churn)
    if (inputData.monthly_charges > 80) score += 0.4;
    else if (inputData.monthly_charges < 40) score -= 0.2;
    
    // Contract type factor
    if (inputData.contract_type === 0) score += 0.6; // Month-to-month
    else if (inputData.contract_type === 2) score -= 0.4; // Two year
    
    // Payment method factor
    if (inputData.payment_method === 0) score += 0.3; // Electronic check
    else if (inputData.payment_method === 3) score -= 0.2; // Credit card
    
    // Tech support factor
    if (inputData.tech_support === 1) score -= 0.3; // Has tech support
    
    // Internet service factor
    if (inputData.internet_service === 1) score += 0.2; // Fiber optic issues
    
    return score;
  }

  private async getSchema(req: Request, res: Response): Promise<void> {
    try {
      const modelId = req.params.modelId;

      // Provide schemas for different model types
      const schemas = {
        house_price: {
          type: 'object',
          model_type: 'regression',
          description: 'House price prediction model',
          properties: {
            bedrooms: {
              type: 'number',
              minimum: 1,
              maximum: 10,
              description: 'Number of bedrooms'
            },
            bathrooms: {
              type: 'number',
              minimum: 1,
              maximum: 10,
              description: 'Number of bathrooms'
            },
            sqft: {
              type: 'number',
              minimum: 500,
              maximum: 10000,
              description: 'Square footage of the house'
            },
            age: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Age of the house in years'
            }
          },
          required: ['bedrooms', 'bathrooms', 'sqft', 'age'],
          example: {
            bedrooms: 3,
            bathrooms: 2,
            sqft: 1500,
            age: 10
          }
        },
        customer_churn: {
          type: 'object',
          model_type: 'classification',
          description: 'Customer churn prediction model',
          properties: {
            age: {
              type: 'number',
              minimum: 18,
              maximum: 80,
              description: 'Customer age'
            },
            tenure: {
              type: 'number',
              minimum: 1,
              maximum: 72,
              description: 'Months as customer'
            },
            monthly_charges: {
              type: 'number',
              minimum: 20,
              maximum: 120,
              description: 'Monthly bill amount'
            },
            total_charges: {
              type: 'number',
              minimum: 20,
              maximum: 8000,
              description: 'Total amount spent'
            },
            contract_type: {
              type: 'number',
              enum: [0, 1, 2],
              description: 'Contract type (0=Month-to-month, 1=One year, 2=Two year)'
            },
            payment_method: {
              type: 'number',
              enum: [0, 1, 2, 3],
              description: 'Payment method (0=Electronic check, 1=Mailed check, 2=Bank transfer, 3=Credit card)'
            },
            internet_service: {
              type: 'number',
              enum: [0, 1, 2],
              description: 'Internet service (0=DSL, 1=Fiber optic, 2=No)'
            },
            tech_support: {
              type: 'number',
              enum: [0, 1],
              description: 'Has tech support (0=No, 1=Yes)'
            }
          },
          required: ['age', 'tenure', 'monthly_charges', 'total_charges', 'contract_type', 'payment_method', 'internet_service', 'tech_support'],
          example: {
            age: 35,
            tenure: 18,
            monthly_charges: 75.0,
            total_charges: 1350.0,
            contract_type: 1,
            payment_method: 2,
            internet_service: 0,
            tech_support: 1
          }
        }
      };

      // Return both schemas for now (in a real implementation, you'd determine the model type)
      res.json({
        modelId,
        availableSchemas: schemas,
        defaultSchema: schemas.house_price, // Default to house price for backward compatibility
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Schema retrieval error:', error);
      res.status(500).json({
        error: {
          code: 'SCHEMA_ERROR',
          message: 'Failed to retrieve model input schema',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}