const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Test API routes BEFORE static files
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    timestamp: new Date().toISOString(),
    routes: ['models', 'monitoring']
  });
});

app.get('/api/models', (req, res) => {
  res.json([
    {
      id: 'test-model-1',
      name: 'Test Model',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  ]);
});

app.get('/api/monitoring/user/stats', (req, res) => {
  res.json({
    totalModels: 1,
    totalPredictions: 100,
    activeModels: 1,
    averageResponseTime: 150,
    successRate: 99.5
  });
});

// Static files AFTER API routes
app.use(express.static('public'));

// Catch-all for SPA routes
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

const port = 3001;
app.listen(port, () => {
  console.log(`🚀 Test server running on port ${port}`);
  console.log(`Test API: http://localhost:${port}/api/test`);
  console.log(`Models API: http://localhost:${port}/api/models`);
  console.log(`Stats API: http://localhost:${port}/api/monitoring/user/stats`);
});