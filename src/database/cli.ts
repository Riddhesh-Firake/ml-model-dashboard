#!/usr/bin/env node

import 'dotenv/config';
import { DatabaseManager } from './database.manager';
import { databaseConfig } from '../config/database.config';
import { developmentSeedData, testSeedData } from './seeds';

const env = process.env.NODE_ENV || 'development';
const config = databaseConfig[env];

if (!config) {
  console.error(`No database configuration found for environment: ${env}`);
  process.exit(1);
}

const dbManager = new DatabaseManager(config);

async function runCommand() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'migrate':
        console.log('Running database migrations...');
        await dbManager.initialize();
        break;
        
      case 'seed':
        console.log('Seeding database...');
        const seedData = env === 'test' ? testSeedData : developmentSeedData;
        await dbManager.seed(seedData);
        break;
        
      case 'reset':
        console.log('Resetting database...');
        await dbManager.clearData();
        await dbManager.initialize({ seed: true });
        break;
        
      case 'clear':
        console.log('Clearing database data...');
        await dbManager.clearData();
        break;
        
      case 'status':
        console.log('Checking database status...');
        const health = await dbManager.healthCheck();
        console.log('Database Health:', health);
        break;
        
      case 'test-connection':
        console.log('Testing database connection...');
        const isConnected = await dbManager.testConnection();
        console.log('Connection status:', isConnected ? 'Connected' : 'Failed');
        break;
        
      default:
        console.log(`
Database CLI Commands:

  migrate         - Run database migrations
  seed           - Seed database with initial data
  reset          - Clear data and reinitialize with seeds
  clear          - Clear all data from database
  status         - Check database health status
  test-connection - Test database connection

Usage: npm run db <command>
        `);
        break;
    }
  } catch (error) {
    console.error('Database operation failed:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runCommand();
}

export { runCommand };