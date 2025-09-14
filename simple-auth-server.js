// Simple auth server to test registration
const express = require('express');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_HOST?.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

// Simple registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters long',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Hash password and generate API key
    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = 'mlapi_' + crypto.randomBytes(32).toString('hex');
    const userId = uuidv4();
    
    // Insert user
    const insertQuery = `
      INSERT INTO users (id, email, password_hash, api_key, subscription, requests_per_minute, models_limit)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, subscription, requests_per_minute, models_limit, created_at
    `;
    
    const result = await pool.query(insertQuery, [
      userId,
      email,
      passwordHash,
      apiKey,
      'free',
      10,
      5
    ]);
    
    const user = result.rows[0];
    
    console.log('User created successfully:', user.id);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription,
        createdAt: user.created_at,
        rateLimits: {
          requestsPerMinute: user.requests_per_minute,
          modelsLimit: user.models_limit
        }
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Registration failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Simple auth server is working' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Simple auth server running on port ${PORT}`);
  console.log(`Test registration: POST http://localhost:${PORT}/api/auth/register`);
});