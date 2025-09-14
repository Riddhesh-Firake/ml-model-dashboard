async function testAuthEndpoints() {
  const endpoints = [
    { method: 'GET', url: 'http://localhost:3000/api/auth' },
    { method: 'POST', url: 'http://localhost:3000/api/auth/register' },
    { method: 'POST', url: 'http://localhost:3000/api/auth/login' },
    { method: 'GET', url: 'http://localhost:3000/api/auth/profile' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting ${endpoint.method} ${endpoint.url}`);
      
      const options = {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (endpoint.method === 'POST') {
        options.body = JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword123'
        });
      }
      
      const response = await fetch(endpoint.url, options);
      const text = await response.text();
      
      console.log(`Status: ${response.status}`);
      console.log(`Response: ${text.substring(0, 200)}`);
      
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
}

testAuthEndpoints();