import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { DatabaseConnection } from '../connection';
import { DatabaseError } from '../../models/error.model';

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  userId: string;
  name: string;
  keyHash: string;
  expiresAt?: Date;
}

export interface UpdateApiKeyRequest {
  name?: string;
  isActive?: boolean;
  expiresAt?: Date;
  keyHash?: string;
}

export class ApiKeyRepository extends BaseRepository<ApiKey, CreateApiKeyRequest, UpdateApiKeyRequest> {
  constructor(db: DatabaseConnection) {
    super(db, 'api_keys');
  }

  async create(data: CreateApiKeyRequest): Promise<ApiKey> {
    const id = uuidv4();
    const query = `
      INSERT INTO api_keys (id, user_id, name, key_hash, is_active, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const params = [
      id,
      data.userId,
      data.name,
      data.keyHash,
      true, // isActive defaults to true
      data.expiresAt || null
    ];

    try {
      const result = await this.executeQuery(query, params);
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to create API key', { data, error });
    }
  }

  async findById(id: string): Promise<ApiKey | null> {
    const query = 'SELECT * FROM api_keys WHERE id = $1';
    
    try {
      const result = await this.executeQuery(query, [id]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find API key by id', { id, error });
    }
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const query = 'SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true';
    
    try {
      const result = await this.executeQuery(query, [keyHash]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find API key by hash', { error });
    }
  }

  async findByUserId(userId: string): Promise<ApiKey[]> {
    const query = 'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC';
    
    try {
      const result = await this.executeQuery(query, [userId]);
      return result.rows.map((row: any) => this.mapRowToEntity(row));
    } catch (error) {
      throw new DatabaseError('Failed to find API keys by user id', { userId, error });
    }
  }

  async findAll(): Promise<ApiKey[]> {
    const query = 'SELECT * FROM api_keys ORDER BY created_at DESC';
    
    try {
      const result = await this.executeQuery(query);
      return result.rows.map((row: any) => this.mapRowToEntity(row));
    } catch (error) {
      throw new DatabaseError('Failed to find all API keys', { error });
    }
  }

  async update(id: string, data: UpdateApiKeyRequest): Promise<ApiKey> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
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
      UPDATE api_keys 
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
      throw new DatabaseError('Failed to update API key', { id, data, error });
    }
  }

  async countActiveKeysByUser(userId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM api_keys WHERE user_id = $1 AND is_active = true';
    
    try {
      const result = await this.executeQuery(query, [userId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw new DatabaseError('Failed to count active API keys', { userId, error });
    }
  }

  async updateLastUsed(keyHash: string): Promise<void> {
    const query = 'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = $1';
    
    try {
      await this.executeQuery(query, [keyHash]);
    } catch (error) {
      throw new DatabaseError('Failed to update last used timestamp', { error });
    }
  }

  async deactivateApiKey(id: string): Promise<ApiKey> {
    const query = `
      UPDATE api_keys 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.executeQuery(query, [id]);
      if (result.rows.length === 0) {
        this.throwNotFoundError(id);
      }
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to deactivate API key', { id, error });
    }
  }

  async deleteExpiredKeys(): Promise<number> {
    const query = 'DELETE FROM api_keys WHERE expires_at < CURRENT_TIMESTAMP';
    
    try {
      const result = await this.executeQuery(query);
      return result.rowCount || 0;
    } catch (error) {
      throw new DatabaseError('Failed to delete expired API keys', { error });
    }
  }

  protected override mapRowToEntity(row: any): ApiKey {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      keyHash: row.key_hash,
      isActive: row.is_active,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}