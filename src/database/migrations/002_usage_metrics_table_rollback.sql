-- Rollback: Remove model usage metrics table

-- Drop indexes first
DROP INDEX IF EXISTS idx_model_usage_metrics_failed;
DROP INDEX IF EXISTS idx_model_usage_metrics_model_timestamp;
DROP INDEX IF EXISTS idx_model_usage_metrics_success;
DROP INDEX IF EXISTS idx_model_usage_metrics_timestamp;
DROP INDEX IF EXISTS idx_model_usage_metrics_model_id;

-- Drop the table
DROP TABLE IF EXISTS model_usage_metrics;