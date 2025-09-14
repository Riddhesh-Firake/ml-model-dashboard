const express = require('express');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple mock auth middleware
const mockAuth = (req, res, next) => {
  req.user = { id: 'demo-user', email: 'user@example.com' };
  next();
};

// Simple in-memory storage for demo
let models = [];
let modelCounter = 1;

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    timestamp: new Date().toISOString(),
    routes: ['auth', 'models', 'predict', 'docs', 'monitoring']
  });
});

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  res.json({
    message: 'User registered successfully',
    user: { id: 'demo-user', email },
    token: 'demo-jwt-token'
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  res.json({
    message: 'Login successful',
    user: { id: 'demo-user', email },
    token: 'demo-jwt-token'
  });
});

// Model routes
app.get('/api/models', mockAuth, (req, res) => {
  const userModels = models.map(model => ({
    id: model.id,
    name: model.name,
    description: model.description,
    status: model.status,
    format: model.format,
    createdAt: model.createdAt,
    lastUsed: model.lastUsed,
    fileSize: model.fileSize,
    endpoint: `/api/models/${model.id}/predict`,
    requestCount: model.requestCount || 0,
    avgResponseTime: model.avgResponseTime || 0,
    successRate: model.successRate || 100
  }));
  
  res.json(userModels);
});

app.post('/api/models/upload', mockAuth, (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Model name is required' });
  }
  
  const model = {
    id: `model-${modelCounter++}`,
    name: name.trim(),
    description: description?.trim() || '',
    status: 'active',
    format: 'pkl',
    createdAt: new Date().toISOString(),
    lastUsed: null,
    fileSize: 1024000,
    userId: req.user.id,
    requestCount: 0,
    avgResponseTime: 0,
    successRate: 100
  };
  
  models.push(model);
  
  res.status(201).json({
    message: 'Model uploaded successfully',
    model: {
      id: model.id,
      name: model.name,
      description: model.description,
      status: model.status,
      format: model.format,
      createdAt: model.createdAt,
      endpoint: `/api/models/${model.id}/predict`,
      fileSize: model.fileSize
    }
  });
});

app.get('/api/models/:id', mockAuth, (req, res) => {
  const model = models.find(m => m.id === req.params.id);
  
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  res.json({
    id: model.id,
    name: model.name,
    description: model.description,
    status: model.status,
    format: model.format,
    createdAt: model.createdAt,
    lastUsed: model.lastUsed,
    fileSize: model.fileSize,
    endpoint: `/api/models/${model.id}/predict`,
    requestCount: model.requestCount || 0,
    avgResponseTime: model.avgResponseTime || 0,
    successRate: model.successRate || 100
  });
});

app.put('/api/models/:id', mockAuth, (req, res) => {
  const model = models.find(m => m.id === req.params.id);
  
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  const { name, description, status } = req.body;
  
  // Update model properties
  if (name !== undefined) model.name = name.trim();
  if (description !== undefined) model.description = description.trim();
  if (status !== undefined && ['active', 'inactive', 'training'].includes(status)) {
    model.status = status;
  }
  
  res.json({
    message: 'Model updated successfully',
    model: {
      id: model.id,
      name: model.name,
      description: model.description,
      status: model.status,
      format: model.format,
      createdAt: model.createdAt,
      lastUsed: model.lastUsed,
      fileSize: model.fileSize,
      endpoint: `/api/models/${model.id}/predict`,
      requestCount: model.requestCount || 0,
      avgResponseTime: model.avgResponseTime || 0,
      successRate: model.successRate || 100
    }
  });
});

app.delete('/api/models/:id', mockAuth, (req, res) => {
  const modelIndex = models.findIndex(m => m.id === req.params.id);
  
  if (modelIndex === -1) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  const deletedModel = models.splice(modelIndex, 1)[0];
  
  res.json({
    message: 'Model deleted successfully',
    model: {
      id: deletedModel.id,
      name: deletedModel.name
    }
  });
});

// Prediction routes
app.post('/api/predict/:modelId', mockAuth, (req, res) => {
  const model = models.find(m => m.id === req.params.modelId);
  
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  const inputData = req.body;
  
  // Mock prediction based on input (for house price model)
  let prediction = 250000; // Default prediction
  
  if (inputData.bedrooms && inputData.bathrooms && inputData.sqft && inputData.age !== undefined) {
    // Simple mock calculation for house price
    prediction = 50000 + 
                (inputData.bedrooms * 25000) + 
                (inputData.bathrooms * 15000) + 
                (inputData.sqft * 100) - 
                (inputData.age * 1000);
  }
  
  // Update model stats
  model.lastUsed = new Date().toISOString();
  model.requestCount = (model.requestCount || 0) + 1;
  
  res.json({
    prediction: Math.round(prediction * 100) / 100,
    model_id: model.id,
    timestamp: new Date().toISOString(),
    input: inputData
  });
});

// Monitoring routes
app.get('/api/monitoring/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    models: models.length
  });
});

app.get('/api/monitoring/metrics', (req, res) => {
  res.json({
    totalModels: models.length,
    totalPredictions: models.reduce((sum, m) => sum + (m.requestCount || 0), 0),
    activeModels: models.filter(m => m.status === 'active').length,
    timestamp: new Date().toISOString()
  });
});

// Documentation routes
app.get('/docs', (req, res) => {
  res.json({
    title: 'ML Model Upload API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      models: {
        list: 'GET /api/models',
        upload: 'POST /api/models/upload',
        get: 'GET /api/models/:id',
        update: 'PUT /api/models/:id',
        delete: 'DELETE /api/models/:id',
        predict: 'POST /api/predict/:modelId'
      },
      monitoring: {
        health: 'GET /api/monitoring/health',
        metrics: 'GET /api/monitoring/metrics'
      }
    }
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/dashboard', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/upload', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/models', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    }
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  });
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/docs`);
  console.log(`🔐 Auth endpoints: http://localhost:${port}/api/auth`);
  console.log(`📊 Model endpoints: http://localhost:${port}/api/models`);
  console.log(`🔮 Prediction endpoints: http://localhost:${port}/api/predict`);
  console.log(`📈 Monitoring: http://localhost:${port}/api/monitoring`);
  console.log(`🌐 Frontend: http://localhost:${port}/`);
});