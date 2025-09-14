import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { StoredModel, ModelFormat } from '../../models/model.model';
import { DatabaseConnection } from '../connection';
import { DatabaseError } from '../../models/error.model';

export interface CreateStoredModelRequest {
  modelId: string;
  originalName: string;
  storagePath: string;
  fileSize: number;
  checksum: string;
  encryptionKey: string;
  format: ModelFormat;
}

export class StoredModelRepository extends BaseRepository<StoredModel, CreateStoredModelRequest, Partial<StoredModel>> {
  constructor(db: DatabaseConnection) {
    super(db, 'stored_models');
  }

  async create(data: CreateStoredModelRequest): Promise<StoredModel> {
    const id = uuidv4();
    const query = `
      INSERT INTO stored_models (id, model_id, original_name, storage_path, file_size, checksum, encryption_key, format)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const params = [
      id,
      data.modelId,
      data.originalName,
      data.storagePath,
      data.fileSize,
      data.checksum,
      data.encryptionKey,
      data.format
    ];

    try {
      const result = await this.executeQuery(query, params);
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to create stored model', { data, error });
    }
  }

  async findById(id: string): Promise<StoredModel | null> {
    const query = 'SELECT * FROM stored_models WHERE id = $1';
    
    try {
      const result = await this.executeQuery(query, [id]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find stored model by id', { id, error });
    }
  }

  async findByModelId(modelId: string): Promise<StoredModel | null> {
    const query = 'SELECT * FROM stored_models WHERE model_id = $1';
    
    try {
      const result = await this.executeQuery(query, [modelId]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find stored model by model id', { modelId, error });
    }
  }

  async findByStoragePath(storagePath: string): Promise<StoredModel | null> {
    const query = 'SELECT * FROM stored_models WHERE storage_path = $1';
    
    try {
      const result = await this.executeQuery(query, [storagePath]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find stored model by storage path', { storagePath, error });
    }
  }

  async findAll(filters?: any): Promise<StoredModel[]> {
    const { clause, params } = this.buildWhereClause(filters || {});
    const query = `SELECT * FROM stored_models ${clause} ORDER BY created_at DESC`;
    
    try {
      const result = await this.executeQuery(query, params);
      return result.rows.map((row: any) => this.mapRowToEntity(row));
    } catch (error) {
      throw new DatabaseError('Failed to find stored models', { filters, error });
    }
  }

  async update(id: string, data: Partial<StoredModel>): Promise<StoredModel> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'createdAt') {
        const snakeKey = this.camelToSnake(key);
        updateFields.push(`${snakeKey} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new DatabaseError('No fields to update');
    }

    params.push(id); // Add id as last parameter
    const query = `
      UPDATE stored_models 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.executeQuery(query, params);
      if (result.rows.length === 0) {
        this.throwNotFoundError(id);
      }
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to update stored model', { id, data, error });
    }
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_files,
        COALESCE(SUM(file_size), 0) as total_size,
        COALESCE(AVG(file_size), 0) as average_size
      FROM stored_models
    `;

    try {
      const result = await this.executeQuery(query);
      const row = result.rows[0];
      
      return {
        totalFiles: parseInt(row.total_files),
        totalSize: parseInt(row.total_size),
        averageSize: parseFloat(row.average_size)
      };
    } catch (error) {
      throw new DatabaseError('Failed to get storage stats', { error });
    }
  }
}