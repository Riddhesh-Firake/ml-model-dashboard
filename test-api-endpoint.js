const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testApiEndpoint() {
  try {
    console.log('Testing API endpoint...');
    
    const response = await fetch('http://localhost:3000/api/test', {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API endpoint working!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ API endpoint failed:');
      console.error('Status:', response.status);
      const text = await response.text();
      console.error('Response:', text);
    }
    
  } catch (error) {
    console.error('❌ API test failed:');
    console.error('Error:', error.message);
  }
}

testApiEndpoint();