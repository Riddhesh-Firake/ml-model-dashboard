// Test database connection
const { Pool } = require('pg');
require('dotenv').config();

async function testDatabaseConnection() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST?.includes('supabase.co') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Test if users table exists
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'users'");
    if (result.rows.length > 0) {
      console.log('✅ Users table exists');
    } else {
      console.log('❌ Users table does not exist');
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testDatabaseConnection();