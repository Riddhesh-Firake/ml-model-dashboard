import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { User, CreateUserRequest } from '../../models/user.model';
import { DatabaseConnection } from '../connection';
import { DatabaseError } from '../../models/error.model';

export interface UserFilters {
  email?: string;
  subscription?: string;
}

export class UserRepository extends BaseRepository<User, CreateUserRequest, Partial<User>> {
  constructor(db: DatabaseConnection) {
    super(db, 'users');
  }

  async create(data: CreateUserRequest & { apiKey: string; passwordHash: string }): Promise<User> {
    const id = uuidv4();
    const query = `
      INSERT INTO users (id, email, password_hash, api_key, subscription, requests_per_minute, models_limit)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const params = [
      id,
      data.email,
      data.passwordHash,
      data.apiKey,
      'free', // default subscription
      10,     // default requests per minute
      5       // default models limit
    ];

    try {
      const result = await this.executeQuery(query, params);
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to create user', { data, error });
    }
  }

  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    
    try {
      const result = await this.executeQuery(query, [id]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find user by id', { id, error });
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    
    try {
      const result = await this.executeQuery(query, [email]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find user by email', { email, error });
    }
  }

  async findByApiKey(apiKey: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE api_key = $1';
    
    try {
      const result = await this.executeQuery(query, [apiKey]);
      return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      throw new DatabaseError('Failed to find user by API key', { error });
    }
  }

  async findAll(filters?: UserFilters): Promise<User[]> {
    const { clause, params } = this.buildWhereClause(filters || {});
    const query = `SELECT * FROM users ${clause} ORDER BY created_at DESC`;
    
    try {
      const result = await this.executeQuery(query, params);
      return result.rows.map((row: any) => this.mapRowToEntity(row));
    } catch (error) {
      throw new DatabaseError('Failed to find users', { filters, error });
    }
  }

  async update(id: string, data: Partial<User>): Promise<User> {
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
      UPDATE users 
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
      throw new DatabaseError('Failed to update user', { id, data, error });
    }
  }

  async updateRateLimits(id: string, rateLimits: { requestsPerMinute: number; modelsLimit: number }): Promise<User> {
    const query = `
      UPDATE users 
      SET requests_per_minute = $1, models_limit = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result = await this.executeQuery(query, [
        rateLimits.requestsPerMinute,
        rateLimits.modelsLimit,
        id
      ]);
      
      if (result.rows.length === 0) {
        this.throwNotFoundError(id);
      }
      
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      throw new DatabaseError('Failed to update user rate limits', { id, rateLimits, error });
    }
  }

  async findByEmailWithPassword(email: string): Promise<{ passwordHash: string } | null> {
    const query = 'SELECT password_hash FROM users WHERE email = $1';
    
    try {
      const result = await this.executeQuery(query, [email]);
      return result.rows.length > 0 ? { passwordHash: result.rows[0].password_hash } : null;
    } catch (error) {
      throw new DatabaseError('Failed to find user password by email', { error });
    }
  }

  protected override mapRowToEntity(row: any): User {
    return {
      id: row.id,
      email: row.email,
      apiKey: row.api_key,
      createdAt: new Date(row.created_at),
      subscription: row.subscription,
      rateLimits: {
        requestsPerMinute: row.requests_per_minute,
        modelsLimit: row.models_limit
      }
    };
  }

  protected override buildWhereClause(filters: UserFilters): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.email) {
      conditions.push(`email = $${paramIndex}`);
      params.push(filters.email);
      paramIndex++;
    }

    if (filters.subscription) {
      conditions.push(`subscription = $${paramIndex}`);
      params.push(filters.subscription);
      paramIndex++;
    }

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, params };
  }

  protected override camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}