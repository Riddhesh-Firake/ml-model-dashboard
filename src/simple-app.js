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

// Debug endpoint - with optional user filtering
app.get('/api/debug/models', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  let debugInfo = {
    success: true,
    debug: true,
    totalModels: uploadedModels.length,
    totalUsers: users.size,
    activeSessions: sessions.size
  };
  
  if (token && sessions.has(token)) {
    const session = sessions.get(token);
    const userId = session.user.id;
    const userModels = uploadedModels.filter(m => m.userId === userId);
    
    debugInfo.authenticatedUser = session.user.email;
    debugInfo.userModels = userModels.length;
    debugInfo.userModelsData = userModels;
  } else {
    debugInfo.allModels = uploadedModels;
    debugInfo.note = 'Add Authorization header with Bearer token to see user-specific data';
  }
  
  res.json(debugInfo);
});

// In-memory user storage for demo
let users = new Map();
let sessions = new Map();

// Helper function to generate user ID from email
function getUserIdFromEmail(email) {
  return email.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// Authentication middleware
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  console.log('🔐 Auth check - Token:', token);
  
  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({
      error: {
        code: 'NO_TOKEN',
        message: 'Authentication token required'
      }
    });
  }
  
  const session = sessions.get(token);
  if (!session) {
    console.log('❌ Invalid token:', token);
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
  
  // Check if session is expired (24 hours)
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    console.log('❌ Token expired:', token);
    return res.status(401).json({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired'
      }
    });
  }
  
  req.user = session.user;
  console.log('✅ User authenticated:', req.user.email);
  next();
}

// Mock authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔑 Login attempt:', email);
  
  // Simple mock authentication - any email/password combo works for demo
  if (email && password) {
    const userId = getUserIdFromEmail(email);
    
    // Create or get user
    if (!users.has(userId)) {
      users.set(userId, {
        id: userId,
        email: email,
        name: email.split('@')[0],
        createdAt: new Date().toISOString()
      });
      console.log('👤 New user created:', userId);
    }
    
    const user = users.get(userId);
    const token = `token-${userId}-${Date.now()}`;
    
    // Create session
    sessions.set(token, {
      user: user,
      createdAt: Date.now()
    });
    
    console.log('✅ Login successful for:', email);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
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
  
  console.log('📝 Registration attempt:', email);
  
  if (email && password) {
    const userId = getUserIdFromEmail(email);
    
    // Check if user already exists
    if (users.has(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }
    
    // Create new user
    const user = {
      id: userId,
      email: email,
      name: email.split('@')[0],
      createdAt: new Date().toISOString()
    };
    
    users.set(userId, user);
    console.log('👤 User registered:', userId);
    
    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Email and password required'
    });
  }
});

app.get('/api/auth/profile', authenticateUser, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// In-memory storage for demo
let uploadedModels = [];

// Initialize with some demo models for different users
function initializeDemoModels() {
  // Only initialize if no models exist
  if (uploadedModels.length === 0) {
    uploadedModels = [
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
        successRate: 96,
        userId: 'demo-user', // Demo user
        userEmail: 'demo@example.com'
      }
    ];
  }
}

// Initialize demo models
initializeDemoModels();

// Mock models endpoints - now with user filtering
app.get('/api/models', authenticateUser, (req, res) => {
  const userId = req.user.id;
  console.log('📋 Models request for user:', userId);
  console.log('📋 Total models in storage:', uploadedModels.length);
  
  // Filter models by user
  const userModels = uploadedModels.filter(model => model.userId === userId);
  console.log('📋 User models found:', userModels.length);
  
  // Return the user's models array directly
  res.json(userModels);
});

// Mock upload endpoint with persistence - now with user authentication
app.post('/api/models/upload', authenticateUser, upload.single('modelFile'), (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  
  console.log('📤 Upload request received from user:', userEmail);
  console.log('📄 Body:', req.body);
  console.log('📁 File:', req.file);
  
  const modelName = req.body?.modelName || req.body?.name || 'Uploaded Model';
  const description = req.body?.description || 'Uploaded via dashboard';
  const modelId = `model-${userId}-${Date.now()}`;
  
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
    successRate: 100,
    userId: userId,
    userEmail: userEmail
  };
  
  uploadedModels.push(newModel);
  
  console.log('✅ Model added to storage for user:', userEmail);
  console.log('📊 Total models now:', uploadedModels.length);
  console.log('📊 User models now:', uploadedModels.filter(m => m.userId === userId).length);
  
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

// Get individual model endpoint - with user authentication
app.get('/api/models/:id', authenticateUser, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  console.log('🔍 Getting model with ID:', id, 'for user:', userId);
  
  const model = uploadedModels.find(m => m.id === id && m.userId === userId);
  
  if (!model) {
    console.log('❌ Model not found or access denied:', id);
    res.status(404).json({
      error: {
        code: 'MODEL_NOT_FOUND',
        message: `Model with ID ${id} not found or access denied`,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  console.log('✅ Model found for user:', model);
  res.json(model);
});

// Mock prediction endpoint - with user authentication
app.post('/api/predict/:modelId', authenticateUser, (req, res) => {
  const { modelId } = req.params;
  const inputData = req.body;
  const userId = req.user.id;
  
  console.log('🔮 Prediction request for model:', modelId, 'by user:', userId);
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
  
  // Check if model exists and belongs to the user
  const model = uploadedModels.find(m => m.id === modelId && m.userId === userId);
  if (!model) {
    console.log('❌ Model not found or access denied for prediction:', modelId);
    res.status(404).json({
      error: {
        code: 'MODEL_NOT_FOUND',
        message: `Model with ID ${modelId} not found or access denied`,
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
  
  console.log('✅ Prediction generated for user model:', { prediction, confidence });
  
  res.json({
    modelId: modelId,
    prediction: prediction,
    confidence: Math.round(confidence * 1000) / 1000,
    processingTime: Math.random() * 100 + 50,
    timestamp: new Date().toISOString(),
    input: inputData
  });
});

// Mock monitoring endpoints - now user-specific
app.get('/api/monitoring/user/stats', authenticateUser, (req, res) => {
  const userId = req.user.id;
  const userModels = uploadedModels.filter(m => m.userId === userId);
  
  // Calculate user-specific stats
  const totalRequests = userModels.reduce((sum, model) => sum + (model.requestCount || 0), 0);
  const avgResponseTime = userModels.length > 0 
    ? userModels.reduce((sum, model) => sum + (model.avgResponseTime || 0), 0) / userModels.length 
    : 0;
  const successfulRequests = Math.floor(totalRequests * 0.97); // 97% success rate
  const errorCount = totalRequests - successfulRequests;
  
  res.json({
    success: true,
    totalRequests: totalRequests,
    avgResponseTime: Math.round(avgResponseTime),
    successfulRequests: successfulRequests,
    errorCount: errorCount,
    totalModels: userModels.length,
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