// Utility types for the application

// Make all properties optional except specified ones
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// Make all properties required except specified ones
export type RequiredExcept<T, K extends keyof T> = Required<T> & Partial<Pick<T, K>>;

// Extract keys of a type that are of a specific type
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

// Create a type with only the specified keys
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

// Database entity base type
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Audit fields for tracking changes
export interface AuditFields {
  createdBy?: string;
  updatedBy?: string;
  version?: number;
}

// Soft delete fields
export interface SoftDeleteFields {
  deletedAt?: Date;
  deletedBy?: string;
}

// Complete entity with all tracking fields
export interface TrackedEntity extends BaseEntity, AuditFields, SoftDeleteFields {}

// Repository operation result
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  affectedRows?: number;
}

// Query filters for repositories
export interface QueryFilters {
  [key: string]: any;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// File upload metadata
export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  encoding: string;
  fieldName: string;
}

// Environment configuration type
export type Environment = 'development' | 'production' | 'test' | 'staging';

// Configuration validation result
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}