import { appConfig, AppConfig } from './app.config';
import { databaseConfig, DatabaseConfig } from './database.config';
import { storageConfig, StorageConfig } from './storage.config';

export interface Config {
  app: AppConfig;
  database: DatabaseConfig;
  storage: StorageConfig;
}

const environment = process.env.NODE_ENV || 'development';

export const config: Config = {
  app: (appConfig[environment] || appConfig.development) as AppConfig,
  database: (databaseConfig[environment] || databaseConfig.development) as DatabaseConfig,
  storage: (storageConfig[environment] || storageConfig.development) as StorageConfig,
};

export * from './app.config';
export * from './database.config';
export * from './storage.config';