// Minimal server to test route mounting
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route working' });
});

// Simple auth route
app.post('/api/auth/register', (req, res) => {
  res.json({ message: 'Registration endpoint working', body: req.body });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🚀 Minimal server running on port ${PORT}`);
  console.log(`Test: http://localhost:${PORT}/api/test`);
  console.log(`Register: POST http://localhost:${PORT}/api/auth/register`);
});