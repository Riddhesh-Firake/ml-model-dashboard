import * as Joi from 'joi';
import { ValidationError } from './error.model';

/**
 * Validates data against a Joi schema and throws ValidationError if invalid
 */
export function validateSchema<T>(data: any, schema: Joi.Schema): T {
  const { error, value } = schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    throw new ValidationError('Validation failed', details);
  }
  
  return value as T;
}

/**
 * Validates data against a Joi schema and returns validation result
 */
export function validateSchemaAsync<T>(data: any, schema: Joi.Schema): Promise<T> {
  return new Promise((resolve, reject) => {
    const { error, value } = schema.validate(data, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      reject(new ValidationError('Validation failed', details));
    } else {
      resolve(value as T);
    }
  });
}

/**
 * Validates data against a Joi schema and returns boolean result
 */
export function isValidSchema(data: any, schema: Joi.Schema): boolean {
  const { error } = schema.validate(data);
  return !error;
}

/**
 * Gets validation errors without throwing
 */
export function getValidationErrors(data: any, schema: Joi.Schema): string[] {
  const { error } = schema.validate(data, { abortEarly: false });
  
  if (!error) {
    return [];
  }
  
  return error.details.map(detail => detail.message);
}