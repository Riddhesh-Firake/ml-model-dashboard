const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testServerHealth() {
  try {
    console.log('Testing server health...');
    
    // Test if server is responding at all
    const response = await fetch('http://localhost:3000/', {
      method: 'GET'
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response:', text);
    
  } catch (error) {
    console.error('❌ Server health check failed:');
    console.error('Error:', error.message);
  }
}

testServerHealth();