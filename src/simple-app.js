// Ultra-simple Express app for deployment
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 10000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        const fs = require('fs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handle form data
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic API endpoints
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'ML Model Dashboard API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    modelsCount: uploadedModels.length
  });
});

// Debug endpoint
app.get('/api/debug/models', (req, res) => {
  res.json({
    success: true,
    debug: true,
    modelsCount: uploadedModels.length,
    models: uploadedModels,
    rawModels: JSON.stringify(uploadedModels, null, 2)
  });
});

// Mock authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Simple mock authentication
  if (email && password) {
    res.json({
      success: true,
      message: 'Login successful',
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 1,
        email: email,
        name: 'Demo User'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Email and password required'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  
  if (email && password) {
    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: 1,
        email: email,
        name: 'Demo User'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Email and password required'
    });
  }
});

app.get('/api/auth/profile', (req, res) => {
  res.json({
    success: true,
    user: {
      id: 1,
      email: 'demo@example.com',
      name: 'Demo User'
    }
  });
});

// In-memory storage for demo
let uploadedModels = [
  {
    id: 'demo-model-1',
    name: 'Demo Customer Churn Model',
    description: 'Predicts customer churn based on usage patterns',
    status: 'active',
    format: 'pkl',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    fileSize: 2048576,
    endpoint: '/api/predict/demo-model-1',
    requestCount: 1247,
    avgResponseTime: 145,
    successRate: 96
  }
];

// Mock models endpoints
app.get('/api/models', (req, res) => {
  console.log('📋 Models request - Current storage:', uploadedModels.length, 'models');
  console.log('📋 Models data:', uploadedModels);
  
  // Return the models array directly (not wrapped in an object)
  res.json(uploadedModels);
});

// Mock upload endpoint with persistence
app.post('/api/models/upload', upload.single('modelFile'), (req, res) => {
  console.log('📤 Upload request received');
  console.log('📄 Body:', req.body);
  console.log('📁 File:', req.file);
  
  const modelName = req.body?.modelName || req.body?.name || 'Uploaded Model';
  const description = req.body?.description || 'Uploaded via dashboard';
  const modelId = `model-${Date.now()}`;
  
  // Get file info if file was uploaded
  let fileSize = 1024576; // Default 1MB
  let format = 'pkl'; // Default format
  
  if (req.file) {
    fileSize = req.file.size;
    format = path.extname(req.file.originalname).toLowerCase().substring(1) || 'pkl';
  }
  
  const newModel = {
    id: modelId,
    name: modelName,
    description: description,
    status: 'active',
    format: format,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    fileSize: fileSize,
    endpoint: `/api/predict/${modelId}`,
    requestCount: 0,
    avgResponseTime: 0,
    successRate: 100
  };
  
  uploadedModels.push(newModel);
  
  console.log('✅ Model added to storage:', newModel);
  console.log('📊 Total models now:', uploadedModels.length);
  
  const endpointUrl = `${req.protocol}://${req.get('host')}/api/predict/${modelId}`;
  
  res.json({
    message: 'Model uploaded successfully',
    modelId: modelId,
    endpointUrl: endpointUrl,
    model: {
      id: modelId,
      name: modelName,
      description: description,
      status: 'active',
      format: format,
      createdAt: newModel.createdAt,
      endpoint: `/api/predict/${modelId}`,
      fileSize: fileSize
    }
  });
});

// Get individual model endpoint
app.get('/api/models/:id', (req, res) => {
  const { id } = req.params;
  console.log('🔍 Getting model with ID:', id);
  
  const model = uploadedModels.find(m => m.id === id);
  
  if (!model) {
    console.log('❌ Model not found:', id);
    res.status(404).json({
      error: {
        code: 'MODEL_NOT_FOUND',
        message: `Model with ID ${id} not found`,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  console.log('✅ Model found:', model);
  res.json(model);
});

// Mock prediction endpoint
app.post('/api/predict/:modelId', (req, res) => {
  const { modelId } = req.params;
  const inputData = req.body;
  
  console.log('🔮 Prediction request for model:', modelId);
  console.log('📊 Input data:', inputData);
  
  // Check if modelId is undefined or empty
  if (!modelId || modelId === 'undefined') {
    console.log('❌ Invalid model ID:', modelId);
    res.status(400).json({
      error: {
        code: 'INVALID_MODEL_ID',
        message: 'Model ID is required and cannot be undefined',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  // Check if model exists
  const model = uploadedModels.find(m => m.id === modelId);
  if (!model) {
    console.log('❌ Model not found for prediction:', modelId);
    res.status(404).json({
      error: {
        code: 'MODEL_NOT_FOUND',
        message: `Model with ID ${modelId} not found`,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  // Update model usage stats
  model.lastUsed = new Date().toISOString();
  model.requestCount = (model.requestCount || 0) + 1;
  
  // Generate mock prediction based on input
  let prediction, confidence;
  
  if (inputData.bedrooms && inputData.bathrooms && inputData.sqft) {
    // House price prediction
    prediction = 50000 + 
                (inputData.bedrooms * 25000) + 
                (inputData.bathrooms * 15000) + 
                (inputData.sqft * 100) - 
                ((inputData.age || 0) * 1000);
    prediction = Math.round(prediction * 100) / 100;
    confidence = 0.85;
  } else {
    // Generic prediction
    prediction = Math.random() > 0.5 ? 1 : 0;
    confidence = 0.75 + Math.random() * 0.2;
  }
  
  console.log('✅ Prediction generated:', { prediction, confidence });
  
  res.json({
    modelId: modelId,
    prediction: prediction,
    confidence: Math.round(confidence * 1000) / 1000,
    processingTime: Math.random() * 100 + 50,
    timestamp: new Date().toISOString(),
    input: inputData
  });
});

// Mock monitoring endpoints
app.get('/api/monitoring/user/stats', (req, res) => {
  res.json({
    success: true,
    totalRequests: 2139,
    avgResponseTime: 189,
    successfulRequests: 2074,
    errorCount: 65,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/monitoring/performance', (req, res) => {
  res.json({
    success: true,
    performance: {
      cpuUsage: 45.2,
      memoryUsage: 67.8,
      responseTime: 189,
      throughput: 1250
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/monitoring/system/stats', (req, res) => {
  res.json({
    success: true,
    system: {
      uptime: 86400,
      totalModels: uploadedModels.length,
      activeUsers: 12,
      totalPredictions: 5432
    },
    timestamp: new Date().toISOString()
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SIMPLE APP: Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://0.0.0.0:${PORT}`);
  console.log(`🔍 Health: http://0.0.0.0:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;