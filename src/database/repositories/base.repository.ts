import { PoolClient } from 'pg';
import { DatabaseConnection } from '../connection';
import { DatabaseError, NotFoundError } from '../../models/error.model';

export interface Repository<T, CreateInput, UpdateInput> {
  create(data: CreateInput): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(filters?: any): Promise<T[]>;
  update(id: string, data: UpdateInput): Promise<T>;
  delete(id: string): Promise<boolean>;
}

export abstract class BaseRepository<T, CreateInput, UpdateInput> 
  implements Repository<T, CreateInput, UpdateInput> {
  
  protected db: DatabaseConnection;
  protected tableName: string;

  constructor(db: DatabaseConnection, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  abstract create(data: CreateInput): Promise<T>;
  abstract findById(id: string): Promise<T | null>;
  abstract findAll(filters?: any): Promise<T[]>;
  abstract update(id: string, data: UpdateInput): Promise<T>;

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `DELETE FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      throw new DatabaseError(`Failed to delete record from ${this.tableName}`, { 
        id, 
        error 
      });
    }
  }

  protected async executeQuery(query: string, params?: any[]): Promise<any> {
    try {
      return await this.db.query(query, params);
    } catch (error) {
      throw new DatabaseError('Query execution failed', { query, params, error });
    }
  }

  protected async executeTransaction<R>(
    callback: (client: PoolClient) => Promise<R>
  ): Promise<R> {
    return await this.db.transaction(callback);
  }

  protected throwNotFoundError(id: string): never {
    throw new NotFoundError(`Record with id ${id} not found in ${this.tableName}`);
  }

  protected mapRowToEntity(row: any): T {
    // Convert snake_case to camelCase and handle dates
    const entity: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      const camelKey = this.snakeToCamel(key);
      entity[camelKey] = value;
    }
    
    return entity as T;
  }

  protected mapEntityToRow(entity: any): any {
    // Convert camelCase to snake_case
    const row: any = {};
    
    for (const [key, value] of Object.entries(entity)) {
      const snakeKey = this.camelToSnake(key);
      row[snakeKey] = value;
    }
    
    return row;
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  protected camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  protected buildWhereClause(filters: Record<string, any>): { clause: string; params: any[] } {
    if (!filters || Object.keys(filters).length === 0) {
      return { clause: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        const snakeKey = this.camelToSnake(key);
        conditions.push(`${snakeKey} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, params };
  }
}