import { DatabaseConnection } from './connection';
import { MigrationManager, getInitialMigrations } from './migrations';
import { DatabaseSeeder, SeedData, developmentSeedData, testSeedData } from './seeds';
import { UserRepository } from './repositories/user.repository';
import { ModelRepository } from './repositories/model.repository';
import { StoredModelRepository } from './repositories/stored-model.repository';
import { EndpointConfigRepository } from './repositories/endpoint-config.repository';
import { DatabaseConfig } from '../config/database.config';
import { DatabaseError } from '../models/error.model';

export class DatabaseManager {
  private connection: DatabaseConnection;
  private migrationManager: MigrationManager;
  private seeder: DatabaseSeeder;
  
  // Repositories
  public users: UserRepository;
  public models: ModelRepository;
  public storedModels: StoredModelRepository;
  public endpointConfigs: EndpointConfigRepository;

  constructor(config: DatabaseConfig, enableMonitoring: boolean = false) {
    this.connection = new DatabaseConnection(config, enableMonitoring);
    this.migrationManager = new MigrationManager(this.connection);
    this.seeder = new DatabaseSeeder(this.connection);
    
    // Initialize repositories
    this.users = new UserRepository(this.connection);
    this.models = new ModelRepository(this.connection);
    this.storedModels = new StoredModelRepository(this.connection);
    this.endpointConfigs = new EndpointConfigRepository(this.connection);
  }

  /**
   * Initialize database with migrations
   */
  async initialize(options?: { seed?: boolean; seedData?: SeedData }): Promise<void> {
    try {
      // Test connection
      const isConnected = await this.connection.testConnection();
      if (!isConnected) {
        throw new DatabaseError('Failed to connect to database');
      }

      // Run migrations
      await this.migrationManager.runMigrations(getInitialMigrations());
      
      // Seed database if requested
      if (options?.seed) {
        const seedData = options.seedData || this.getDefaultSeedData();
        const isSeeded = await this.seeder.isSeeded();
        
        if (!isSeeded) {
          await this.seeder.seed(seedData);
        } else {
          console.log('Database already seeded, skipping...');
        }
      }
      
      console.log('Database initialized successfully');
    } catch (error) {
      throw new DatabaseError('Failed to initialize database', { error });
    }
  }

  /**
   * Seed database with data
   */
  async seed(data?: SeedData): Promise<void> {
    const seedData = data || this.getDefaultSeedData();
    await this.seeder.seed(seedData);
  }

  /**
   * Clear all data (for testing)
   */
  async clearData(): Promise<void> {
    await this.seeder.clearAllData();
  }

  /**
   * Get default seed data based on environment
   */
  private getDefaultSeedData(): SeedData {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'test':
        return testSeedData;
      case 'development':
        return developmentSeedData;
      default:
        return {}; // No seeding in production by default
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    return await this.connection.testConnection();
  }

  /**
   * Get connection pool status
   */
  getConnectionStatus() {
    return this.connection.getPoolStatus();
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    await this.connection.close();
  }

  /**
   * Get raw database connection for advanced operations
   */
  getConnection(): DatabaseConnection {
    return this.connection;
  }

  /**
   * Execute raw query (use with caution)
   */
  async query(text: string, params?: any[]): Promise<any> {
    return await this.connection.query(text, params);
  }

  /**
   * Execute transaction
   */
  async transaction<T>(callback: (db: DatabaseManager) => Promise<T>): Promise<T> {
    return await this.connection.transaction(async (client) => {
      // Create a temporary database manager with the transaction client
      const transactionDb = Object.create(this);
      transactionDb.connection = { query: client.query.bind(client) };
      return await callback(transactionDb);
    });
  }

  /**
   * Health check for monitoring
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    connection: boolean;
    poolStatus: any;
    timestamp: Date;
    metrics?: any;
  }> {
    try {
      const connection = await this.testConnection();
      const poolStatus = this.getConnectionStatus();
      
      // Get detailed metrics if monitoring is enabled
      let metrics;
      const monitor = this.connection.getMonitor();
      if (monitor) {
        metrics = await monitor.getMetrics();
      }
      
      return {
        status: connection ? 'healthy' : 'unhealthy',
        connection,
        poolStatus,
        timestamp: new Date(),
        metrics
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connection: false,
        poolStatus: null,
        timestamp: new Date()
      };
    }
  }

  /**
   * Start database monitoring
   */
  startMonitoring(intervalMs: number = 30000): NodeJS.Timeout | null {
    const monitor = this.connection.getMonitor();
    if (monitor) {
      return monitor.startMonitoring(intervalMs);
    }
    return null;
  }

  /**
   * Get database metrics
   */
  async getMetrics() {
    const monitor = this.connection.getMonitor();
    if (monitor) {
      return await monitor.getMetrics();
    }
    return null;
  }
}