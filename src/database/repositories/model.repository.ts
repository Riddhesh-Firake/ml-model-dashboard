import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { ModelMetadata, CreateModelRequest, UpdateModelRequest } from '../../models/model.model';
import { DatabaseConnection } from '../connection';
import { DatabaseError } from '../../models/error.model';

export interface ModelFilters {
  userId?: string;
  status?: string;
  fileFormat?: string;
}

export class ModelRepository extends BaseRepository<ModelMetadata, CreateModelRequest, UpdateModelRequest> {
  constructor(db: DatabaseConnection) {
    super(db, 'models');
  }

  async create(data: CreateModelRequest & { 
    fileFormat: string; 
    filePath: string; 
    endpointUrl: string 
  }): Promise<ModelMetadata> {
    const id = uuidv4();
    const query = `
      INSERT INTO models (id, name, description, user_id, file_format, file_path, endpoint_url, status, request_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const params = [
      id,
      data.name,
      data.description,
      data.userId,
      data.fileFormat,
      data.filePath,
      data.endpointUrl,
      'active',
      0
    ];

    try {
      const result = await this.executeQuery(query, params);
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to create model', { data, error });
    }
  }

  async findById(id: string): Promise<ModelMetadata | null> {
    const query = 'SELECT * FROM models WHERE id = $1';
    
    try {
      const result = await this.executeQuery(query, [id]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find model by id', { id, error });
    }
  }

  async findByUserId(userId: string): Promise<ModelMetadata[]> {
    const query = 'SELECT * FROM models WHERE user_id = $1 ORDER BY created_at DESC';
    
    try {
      const result = await this.executeQuery(query, [userId]);
      return result.rows.map((row: any) => this.mapRowToEntity(row));
    } catch (error) {
      throw new DatabaseError('Failed to find models by user id', { userId, error });
    }
  }

  async findByEndpointUrl(endpointUrl: string): Promise<ModelMetadata | null> {
    const query = 'SELECT * FROM models WHERE endpoint_url = $1';
    
    try {
      const result = await this.executeQuery(query, [endpointUrl]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find model by endpoint URL', { endpointUrl, error });
    }
  }

  async findAll(filters?: ModelFilters): Promise<ModelMetadata[]> {
    const { clause, params } = this.buildWhereClause(filters || {});
    const query = `SELECT * FROM models ${clause} ORDER BY created_at DESC`;
    
    try {
      const result = await this.executeQuery(query, params);
      return result.rows.map((row: any) => this.mapRowToEntity(row));
    } catch (error) {
      throw new DatabaseError('Failed to find models', { filters, error });
    }
  }

  async update(id: string, data: UpdateModelRequest): Promise<ModelMetadata> {
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
      UPDATE models 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
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
      throw new DatabaseError('Failed to update model', { id, data, error });
    }
  }

  async incrementRequestCount(id: string): Promise<void> {
    const query = `
      UPDATE models 
      SET request_count = request_count + 1, last_used = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await this.executeQuery(query, [id]);
    } catch (error) {
      throw new DatabaseError('Failed to increment request count', { id, error });
    }
  }

  async getModelStats(userId?: string): Promise<{
    totalModels: number;
    activeModels: number;
    totalRequests: number;
  }> {
    let query = `
      SELECT 
        COUNT(*) as total_models,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_models,
        COALESCE(SUM(request_count), 0) as total_requests
      FROM models
    `;
    
    const params: any[] = [];
    
    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    try {
      const result = await this.executeQuery(query, params);
      const row = result.rows[0];
      
      return {
        totalModels: parseInt(row.total_models),
        activeModels: parseInt(row.active_models),
        totalRequests: parseInt(row.total_requests)
      };
    } catch (error) {
      throw new DatabaseError('Failed to get model stats', { userId, error });
    }
  }
}