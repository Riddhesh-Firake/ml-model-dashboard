import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { EndpointConfig, RateLimitConfig, JSONSchema } from '../../models/prediction.model';
import { DatabaseConnection } from '../connection';
import { DatabaseError } from '../../models/error.model';

export interface CreateEndpointConfigRequest {
  modelId: string;
  url: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  rateLimits: RateLimitConfig;
  authRequired: boolean;
}

export class EndpointConfigRepository extends BaseRepository<EndpointConfig, CreateEndpointConfigRequest, Partial<EndpointConfig>> {
  constructor(db: DatabaseConnection) {
    super(db, 'endpoint_configs');
  }

  async create(data: CreateEndpointConfigRequest): Promise<EndpointConfig> {
    const id = uuidv4();
    const query = `
      INSERT INTO endpoint_configs (
        id, model_id, url, input_schema, output_schema, auth_required,
        requests_per_minute, requests_per_hour, requests_per_day
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const params = [
      id,
      data.modelId,
      data.url,
      JSON.stringify(data.inputSchema),
      JSON.stringify(data.outputSchema),
      data.authRequired,
      data.rateLimits.requestsPerMinute,
      data.rateLimits.requestsPerHour,
      data.rateLimits.requestsPerDay
    ];

    try {
      const result = await this.executeQuery(query, params);
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to create endpoint config', { data, error });
    }
  }

  async findById(id: string): Promise<EndpointConfig | null> {
    const query = 'SELECT * FROM endpoint_configs WHERE id = $1';
    
    try {
      const result = await this.executeQuery(query, [id]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find endpoint config by id', { id, error });
    }
  }

  async findByModelId(modelId: string): Promise<EndpointConfig | null> {
    const query = 'SELECT * FROM endpoint_configs WHERE model_id = $1';
    
    try {
      const result = await this.executeQuery(query, [modelId]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find endpoint config by model id', { modelId, error });
    }
  }

  async findByUrl(url: string): Promise<EndpointConfig | null> {
    const query = 'SELECT * FROM endpoint_configs WHERE url = $1';
    
    try {
      const result = await this.executeQuery(query, [url]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find endpoint config by URL', { url, error });
    }
  }

  async findAll(filters?: any): Promise<EndpointConfig[]> {
    const { clause, params } = this.buildWhereClause(filters || {});
    const query = `SELECT * FROM endpoint_configs ${clause} ORDER BY created_at DESC`;
    
    try {
      const result = await this.executeQuery(query, params);
      return result.rows.map((row: any) => this.mapRowToEntity(row));
    } catch (error) {
      throw new DatabaseError('Failed to find endpoint configs', { filters, error });
    }
  }

  async update(id: string, data: Partial<EndpointConfig>): Promise<EndpointConfig> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'createdAt') {
        let snakeKey = this.camelToSnake(key);
        let processedValue = value;

        // Handle nested objects
        if (key === 'inputSchema' || key === 'outputSchema') {
          processedValue = JSON.stringify(value);
        } else if (key === 'rateLimits') {
          // Handle rate limits object
          const rateLimits = value as RateLimitConfig;
          updateFields.push(`requests_per_minute = $${paramIndex}`);
          params.push(rateLimits.requestsPerMinute);
          paramIndex++;
          
          updateFields.push(`requests_per_hour = $${paramIndex}`);
          params.push(rateLimits.requestsPerHour);
          paramIndex++;
          
          updateFields.push(`requests_per_day = $${paramIndex}`);
          params.push(rateLimits.requestsPerDay);
          paramIndex++;
          continue;
        }

        updateFields.push(`${snakeKey} = $${paramIndex}`);
        params.push(processedValue);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new DatabaseError('No fields to update');
    }

    params.push(id); // Add id as last parameter
    const query = `
      UPDATE endpoint_configs 
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
      throw new DatabaseError('Failed to update endpoint config', { id, data, error });
    }
  }

  protected override mapRowToEntity(row: any): EndpointConfig {
    const entity = super.mapRowToEntity(row) as any;
    
    // Parse JSON fields
    if (entity.inputSchema && typeof entity.inputSchema === 'string') {
      entity.inputSchema = JSON.parse(entity.inputSchema);
    }
    if (entity.outputSchema && typeof entity.outputSchema === 'string') {
      entity.outputSchema = JSON.parse(entity.outputSchema);
    }
    
    // Reconstruct rate limits object
    entity.rateLimits = {
      requestsPerMinute: entity.requestsPerMinute,
      requestsPerHour: entity.requestsPerHour,
      requestsPerDay: entity.requestsPerDay
    };
    
    // Remove individual rate limit fields
    delete entity.requestsPerMinute;
    delete entity.requestsPerHour;
    delete entity.requestsPerDay;
    
    return entity as EndpointConfig;
  }

}