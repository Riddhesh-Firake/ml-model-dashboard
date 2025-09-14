// Simple server to test the routing fix
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// API routes FIRST - this is the key fix
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    timestamp: new Date().toISOString()
  });
});

app.get('/api/models', (req, res) => {
  res.json([]);
});

app.get('/api/monitoring/user/stats', (req, res) => {
  res.json({
    totalModels: 0,
    totalPredictions: 0,
    activeModels: 0,
    averageResponseTime: 0
  });
});

// Static files AFTER API routes
app.use(express.static('public'));

// SPA fallback for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`🚀 Simple server running on port ${port}`);
  console.log(`Frontend: http://localhost:${port}`);
  console.log(`API Test: http://localhost:${port}/api/test`);
});