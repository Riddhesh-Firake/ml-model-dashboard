# Database Module

This module provides comprehensive database functionality for the ML Model Upload API, including connection management, migrations, seeding, and monitoring.

## Features

- **Connection Management**: PostgreSQL connection pooling with automatic retry and error handling
- **Migrations**: Version-controlled database schema management with rollback support
- **Seeding**: Database initialization with test and development data
- **Monitoring**: Real-time connection pool and query performance monitoring
- **Repositories**: Type-safe data access layer with CRUD operations

## Quick Start

### Initialize Database

```typescript
import { DatabaseManager } from './database';
import { databaseConfig } from '../config/database.config';

const dbManager = new DatabaseManager(databaseConfig.development, true);

// Initialize with migrations and seeding
await dbManager.initialize({ seed: true });
```

### Using CLI Commands

```bash
# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Reset database (clear + migrate + seed)
npm run db:reset

# Check database status
npm run db:status
```

## Architecture

### Core Components

1. **DatabaseConnection**: Low-level connection management with pooling
2. **MigrationManager**: Schema version control and migration execution
3. **DatabaseSeeder**: Initial data population for different environments
4. **DatabaseMonitor**: Performance monitoring and health checks
5. **DatabaseManager**: High-level orchestration of all database operations

### Repository Pattern

All data access is handled through repositories that extend `BaseRepository`:

```typescript
// Example usage
const user = await dbManager.users.create({
  email: 'user@example.com',
  password: 'hashedPassword',
  subscription: 'free'
});

const models = await dbManager.models.findAll({ userId: user.id });
```

## Database Schema

### Tables

- **users**: User accounts and subscription information
- **models**: ML model metadata and configuration
- **stored_models**: File storage metadata and encryption keys
- **endpoint_configs**: API endpoint configuration and rate limits
- **model_usage**: Analytics and usage tracking
- **api_keys**: Additional API key management

### Key Features

- UUID primary keys for all tables
- Automatic timestamp management with triggers
- Foreign key constraints for data integrity
- Comprehensive indexing for performance
- JSONB support for flexible schema storage

## Configuration

Database configuration is environment-specific:

```typescript
// .env file
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ml_api_dev
DB_USER=postgres
DB_PASSWORD=password
```

## Monitoring

Enable monitoring to track:

- Connection pool utilization
- Query performance metrics
- Slow query detection
- Health check status

```typescript
const dbManager = new DatabaseManager(config, true); // Enable monitoring
const monitoringInterval = dbManager.startMonitoring(30000); // 30 seconds
```

## Migration Management

### Creating Migrations

Migrations are stored in `src/database/migrations/` with the format:
- `001_migration_name.sql` - Forward migration
- `001_migration_name_rollback.sql` - Rollback migration (optional)

### Migration Commands

```bash
# Create new migration
npm run db migrate

# Rollback last migration (if rollback SQL exists)
npm run db rollback
```

## Testing

The database module includes comprehensive tests:

```bash
# Run database tests
npm test src/database/__tests__/
```

## Error Handling

All database operations use custom error types:

- `DatabaseError`: General database operation failures
- `NotFoundError`: Record not found errors
- Connection errors are automatically retried with exponential backoff

## Performance Considerations

- Connection pooling with configurable limits
- Query performance monitoring
- Automatic connection cleanup
- Index optimization for common queries
- JSONB indexing for flexible data queries

## Security

- Parameterized queries prevent SQL injection
- Connection encryption in production
- API key hashing and secure storage
- Audit logging for security events