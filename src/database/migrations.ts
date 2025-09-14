import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { DatabaseConnection } from './connection';
import { DatabaseError } from '../models/error.model';

export interface Migration {
  id: string;
  name: string;
  sql: string;
  rollbackSql?: string;
}

export class MigrationManager {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Initialize migrations table
   */
  async initializeMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await this.db.query(sql);
    } catch (error) {
      throw new DatabaseError('Failed to initialize migrations table', { error });
    }
  }

  /**
   * Get executed migrations
   */
  async getExecutedMigrations(): Promise<string[]> {
    try {
      const result = await this.db.query('SELECT id FROM migrations ORDER BY executed_at');
      return result.rows.map((row: any) => row.id);
    } catch (error) {
      throw new DatabaseError('Failed to get executed migrations', { error });
    }
  }

  /**
   * Execute a migration
   */
  async executeMigration(migration: Migration): Promise<void> {
    await this.db.transaction(async (client) => {
      try {
        // Execute migration SQL
        await client.query(migration.sql);
        
        // Record migration as executed
        await client.query(
          'INSERT INTO migrations (id, name) VALUES ($1, $2)',
          [migration.id, migration.name]
        );
      } catch (error) {
        throw new DatabaseError(`Failed to execute migration ${migration.id}`, { 
          migration: migration.id, 
          error 
        });
      }
    });
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migration: Migration): Promise<void> {
    if (!migration.rollbackSql) {
      throw new DatabaseError(`No rollback SQL provided for migration ${migration.id}`);
    }

    await this.db.transaction(async (client) => {
      try {
        // Execute rollback SQL
        await client.query(migration.rollbackSql!);
        
        // Remove migration record
        await client.query('DELETE FROM migrations WHERE id = $1', [migration.id]);
      } catch (error) {
        throw new DatabaseError(`Failed to rollback migration ${migration.id}`, { 
          migration: migration.id, 
          error 
        });
      }
    });
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(migrations: Migration[]): Promise<void> {
    await this.initializeMigrationsTable();
    
    const executedMigrations = await this.getExecutedMigrations();
    const pendingMigrations = migrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migrations...`);

    for (const migration of pendingMigrations) {
      console.log(`Executing migration: ${migration.name}`);
      await this.executeMigration(migration);
      console.log(`✓ Migration ${migration.name} completed`);
    }

    console.log('All migrations completed successfully');
  }

  /**
   * Load migration from file
   */
  loadMigrationFromFile(filePath: string, id: string, name: string): Migration {
    try {
      const sql = readFileSync(filePath, 'utf8');
      
      // Try to load rollback SQL if it exists
      const rollbackPath = filePath.replace('.sql', '_rollback.sql');
      let rollbackSql: string | undefined;
      
      if (existsSync(rollbackPath)) {
        rollbackSql = readFileSync(rollbackPath, 'utf8');
      }
      
      return { id, name, sql, rollbackSql };
    } catch (error) {
      throw new DatabaseError(`Failed to load migration file: ${filePath}`, { error });
    }
  }

  /**
   * Load all migrations from directory
   */
  loadMigrationsFromDirectory(directoryPath: string): Migration[] {
    try {
      const files = readdirSync(directoryPath)
        .filter(file => extname(file) === '.sql' && !file.includes('_rollback'))
        .sort();

      return files.map(file => {
        const filePath = join(directoryPath, file);
        const id = file.replace('.sql', '');
        const name = id.replace(/^\d+_/, '').replace(/_/g, ' ');
        
        return this.loadMigrationFromFile(filePath, id, name);
      });
    } catch (error) {
      throw new DatabaseError(`Failed to load migrations from directory: ${directoryPath}`, { error });
    }
  }

  /**
   * Create a new migration file
   */
  createMigrationFile(name: string, sql: string, rollbackSql?: string): string {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}`;
    const migrationPath = join(__dirname, 'migrations');
    
    // Ensure migrations directory exists
    if (!existsSync(migrationPath)) {
      throw new DatabaseError('Migrations directory does not exist');
    }

    const filePath = join(migrationPath, `${fileName}.sql`);
    
    try {
      // Write main migration file
      writeFileSync(filePath, sql);
      
      // Write rollback file if provided
      if (rollbackSql) {
        const rollbackPath = join(migrationPath, `${fileName}_rollback.sql`);
        writeFileSync(rollbackPath, rollbackSql);
      }
      
      return fileName;
    } catch (error) {
      throw new DatabaseError(`Failed to create migration file: ${fileName}`, { error });
    }
  }
}

// Load migrations from files
export function getInitialMigrations(): Migration[] {
  const migrationManager = new MigrationManager({} as DatabaseConnection);
  const migrationsPath = join(__dirname, 'migrations');
  
  // If migrations directory exists, load from there
  if (existsSync(migrationsPath)) {
    return migrationManager.loadMigrationsFromDirectory(migrationsPath);
  }
  
  // Fallback to inline migration for backward compatibility
  return [
    {
      id: '001_initial_schema',
      name: 'Create initial database schema',
      sql: readFileSync(join(__dirname, 'schema.sql'), 'utf8'),
      rollbackSql: `
        DROP TABLE IF EXISTS api_keys CASCADE;
        DROP TABLE IF EXISTS model_usage CASCADE;
        DROP TABLE IF EXISTS endpoint_configs CASCADE;
        DROP TABLE IF EXISTS stored_models CASCADE;
        DROP TABLE IF EXISTS models CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
        DROP EXTENSION IF EXISTS "uuid-ossp";
      `
    }
  ];
}

// For backward compatibility
export const initialMigrations = getInitialMigrations();