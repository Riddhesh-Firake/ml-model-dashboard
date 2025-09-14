// Simple test to check if server starts and auth routes are available
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testServerStartup() {
  try {
    console.log('Testing server startup and auth routes...');
    
    // Test if server is running
    const healthResponse = await fetch('http://localhost:3000/health');
    console.log('Health check status:', healthResponse.status);
    
    // Test API info endpoint
    const apiResponse = await fetch('http://localhost:3000/api');
    if (apiResponse.ok) {
      const apiData = await apiResponse.json();
      console.log('API endpoints available:', Object.keys(apiData.endpoints));
    } else {
      console.log('API endpoint not available, status:', apiResponse.status);
    }
    
    // Test auth endpoint specifically
    const authResponse = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test123' })
    });
    
    console.log('Auth register endpoint status:', authResponse.status);
    
    if (authResponse.status === 404) {
      console.log('❌ Auth routes are not mounted properly');
    } else {
      console.log('✅ Auth routes are accessible');
      const authData = await authResponse.json();
      console.log('Auth response:', authData);
    }
    
  } catch (error) {
    console.error('❌ Server test failed:', error.message);
  }
}

testServerStartup();