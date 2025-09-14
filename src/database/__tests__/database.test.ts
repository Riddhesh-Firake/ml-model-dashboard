import { DatabaseManager } from '../database.manager';
import { databaseConfig } from '../../config/database.config';

describe('Database Implementation', () => {
  let dbManager: DatabaseManager;

  beforeAll(() => {
    // Use test configuration
    const testConfig = databaseConfig.test;
    dbManager = new DatabaseManager(testConfig, true); // Enable monitoring for tests
  });

  afterAll(async () => {
    await dbManager.close();
  });

  describe('Connection', () => {
    it('should connect to database', async () => {
      const isConnected = await dbManager.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should return connection status', () => {
      const status = dbManager.getConnectionStatus();
      expect(status).toHaveProperty('totalCount');
      expect(status).toHaveProperty('idleCount');
      expect(status).toHaveProperty('waitingCount');
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await dbManager.healthCheck();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('connection');
      expect(health).toHaveProperty('poolStatus');
      expect(health).toHaveProperty('timestamp');
      expect(health.status).toBe('healthy');
    });

    it('should include metrics when monitoring is enabled', async () => {
      const health = await dbManager.healthCheck();
      expect(health).toHaveProperty('metrics');
      expect(health.metrics).toHaveProperty('connectionPool');
      expect(health.metrics).toHaveProperty('queryStats');
      expect(health.metrics).toHaveProperty('health');
    });
  });

  describe('Migrations', () => {
    it('should initialize database with migrations', async () => {
      await expect(dbManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Seeding', () => {
    it('should seed database with test data', async () => {
      await expect(dbManager.seed()).resolves.not.toThrow();
    });

    it('should clear database data', async () => {
      await expect(dbManager.clearData()).resolves.not.toThrow();
    });
  });

  describe('Repositories', () => {
    it('should have all required repositories', () => {
      expect(dbManager.users).toBeDefined();
      expect(dbManager.models).toBeDefined();
      expect(dbManager.storedModels).toBeDefined();
      expect(dbManager.endpointConfigs).toBeDefined();
    });
  });

  describe('Monitoring', () => {
    it('should get database metrics', async () => {
      const metrics = await dbManager.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics).toHaveProperty('queryStats');
      expect(metrics).toHaveProperty('health');
    });
  });
});