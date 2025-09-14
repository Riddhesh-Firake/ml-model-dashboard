-- Migration: Add model usage metrics table
-- This table stores detailed usage metrics for model predictions

CREATE TABLE IF NOT EXISTS model_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  response_time INTEGER NOT NULL, -- Response time in milliseconds
  input_size INTEGER NOT NULL, -- Size of input data in bytes
  output_size INTEGER NOT NULL, -- Size of output data in bytes
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_model_usage_metrics_model_id ON model_usage_metrics(model_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_metrics_timestamp ON model_usage_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_model_usage_metrics_success ON model_usage_metrics(success);
CREATE INDEX IF NOT EXISTS idx_model_usage_metrics_model_timestamp ON model_usage_metrics(model_id, timestamp);

-- Create a partial index for failed requests
CREATE INDEX IF NOT EXISTS idx_model_usage_metrics_failed ON model_usage_metrics(model_id, timestamp) 
WHERE success = false;

-- Add comments for documentation
COMMENT ON TABLE model_usage_metrics IS 'Stores detailed usage metrics for model predictions';
COMMENT ON COLUMN model_usage_metrics.model_id IS 'Reference to the model that was used';
COMMENT ON COLUMN model_usage_metrics.response_time IS 'Time taken to process the request in milliseconds';
COMMENT ON COLUMN model_usage_metrics.input_size IS 'Size of the input data in bytes';
COMMENT ON COLUMN model_usage_metrics.output_size IS 'Size of the output data in bytes';
COMMENT ON COLUMN model_usage_metrics.success IS 'Whether the prediction was successful';
COMMENT ON COLUMN model_usage_metrics.error_message IS 'Error message if the prediction failed';
COMMENT ON COLUMN model_usage_metrics.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN model_usage_metrics.ip_address IS 'IP address of the client making the request';