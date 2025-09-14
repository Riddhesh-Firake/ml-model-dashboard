import { DatabaseConnection } from './connection';
import { DatabaseError } from '../models/error.model';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

export interface SeedData {
  users?: Array<{
    email: string;
    password: string;
    subscription?: 'free' | 'premium';
    requestsPerMinute?: number;
    modelsLimit?: number;
  }>;
}

export class DatabaseSeeder {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Seed the database with initial data
   */
  async seed(data: SeedData): Promise<void> {
    try {
      await this.db.transaction(async (client) => {
        // Seed users
        if (data.users && data.users.length > 0) {
          await this.seedUsers(data.users, client);
        }
      });

      console.log('Database seeding completed successfully');
    } catch (error) {
      throw new DatabaseError('Failed to seed database', { error });
    }
  }

  /**
   * Seed users table
   */
  private async seedUsers(users: SeedData['users'], client: any): Promise<void> {
    for (const userData of users!) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const apiKey = this.generateApiKey();

      const query = `
        INSERT INTO users (
          id, email, password_hash, api_key, subscription, 
          requests_per_minute, models_limit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO NOTHING
      `;

      const values = [
        uuidv4(),
        userData.email,
        hashedPassword,
        apiKey,
        userData.subscription || 'free',
        userData.requestsPerMinute || 10,
        userData.modelsLimit || 5
      ];

      await client.query(query, values);
      console.log(`✓ Seeded user: ${userData.email}`);
    }
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    const prefix = 'mlapi_';
    const randomPart = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
    return prefix + randomPart;
  }

  /**
   * Clear all data from tables (for testing)
   */
  async clearAllData(): Promise<void> {
    try {
      await this.db.transaction(async (client) => {
        // Disable foreign key checks temporarily
        await client.query('SET session_replication_role = replica;');

        // Clear tables in reverse dependency order
        const tables = [
          'api_keys',
          'model_usage', 
          'endpoint_configs',
          'stored_models',
          'models',
          'users'
        ];

        for (const table of tables) {
          await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        }

        // Re-enable foreign key checks
        await client.query('SET session_replication_role = DEFAULT;');
      });

      console.log('All data cleared successfully');
    } catch (error) {
      throw new DatabaseError('Failed to clear database data', { error });
    }
  }

  /**
   * Check if database has been seeded
   */
  async isSeeded(): Promise<boolean> {
    try {
      const result = await this.db.query('SELECT COUNT(*) as count FROM users');
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      throw new DatabaseError('Failed to check if database is seeded', { error });
    }
  }
}

// Default seed data for development
export const developmentSeedData: SeedData = {
  users: [
    {
      email: 'admin@example.com',
      password: 'admin123',
      subscription: 'premium',
      requestsPerMinute: 100,
      modelsLimit: 50
    },
    {
      email: 'user@example.com',
      password: 'user123',
      subscription: 'free',
      requestsPerMinute: 10,
      modelsLimit: 5
    }
  ]
};

// Test seed data
export const testSeedData: SeedData = {
  users: [
    {
      email: 'test@example.com',
      password: 'test123',
      subscription: 'free'
    }
  ]
};