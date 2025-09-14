// Ultra-simple Express app for deployment
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Basic middleware
app.use(cors());
app.use(express.json());
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
    timestamp: new Date().toISOString()
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

// Mock models endpoints
app.get('/api/models', (req, res) => {
  res.json({
    success: true,
    models: uploadedModels
  });
});

// In-memory storage for demo
let uploadedModels = [
  {
    id: 1,
    name: 'Demo Model',
    type: 'classification',
    status: 'active',
    created_at: new Date().toISOString()
  }
];

// Mock upload endpoint with persistence
app.post('/api/models/upload', (req, res) => {
  const newModel = {
    id: Date.now(),
    name: req.body.modelName || 'Uploaded Model',
    type: 'classification',
    status: 'active',
    created_at: new Date().toISOString()
  };
  
  uploadedModels.push(newModel);
  
  res.json({
    success: true,
    message: 'Model upload successful (demo)',
    model: newModel
  });
});

// Mock prediction endpoint
app.post('/api/predict/:modelId', (req, res) => {
  const { modelId } = req.params;
  res.json({
    success: true,
    modelId: modelId,
    predictions: [0.85],
    confidence: 0.92,
    timestamp: new Date().toISOString()
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