-- Rollback script for initial schema migration

-- Drop triggers first
DROP TRIGGER IF EXISTS update_endpoint_configs_updated_at ON endpoint_configs;
DROP TRIGGER IF EXISTS update_models_updated_at ON models;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_api_keys_hash;
DROP INDEX IF EXISTS idx_api_keys_user_id;
DROP INDEX IF EXISTS idx_model_usage_timestamp;
DROP INDEX IF EXISTS idx_model_usage_user_id;
DROP INDEX IF EXISTS idx_model_usage_model_id;
DROP INDEX IF EXISTS idx_endpoint_configs_url;
DROP INDEX IF EXISTS idx_endpoint_configs_model_id;
DROP INDEX IF EXISTS idx_stored_models_storage_path;
DROP INDEX IF EXISTS idx_stored_models_model_id;
DROP INDEX IF EXISTS idx_models_endpoint_url;
DROP INDEX IF EXISTS idx_models_status;
DROP INDEX IF EXISTS idx_models_user_id;
DROP INDEX IF EXISTS idx_users_api_key;
DROP INDEX IF EXISTS idx_users_email;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS model_usage CASCADE;
DROP TABLE IF EXISTS endpoint_configs CASCADE;
DROP TABLE IF EXISTS stored_models CASCADE;
DROP TABLE IF EXISTS models CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop extension
DROP EXTENSION IF EXISTS "uuid-ossp";