const http = require('http');

function testAPI(path, expectedType = 'object') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n=== Testing ${path} ===`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);
        console.log(`Response length: ${data.length} chars`);
        
        try {
          const parsed = JSON.parse(data);
          console.log(`✅ Valid JSON response`);
          console.log(`Response type: ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
          console.log(`Sample data:`, JSON.stringify(parsed, null, 2).substring(0, 200));
          resolve({ success: true, data: parsed });
        } catch (error) {
          console.log(`❌ Invalid JSON response`);
          console.log(`Raw response (first 200 chars):`, data.substring(0, 200));
          resolve({ success: false, error: 'Invalid JSON', data });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request failed for ${path}:`, error.message);
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing API endpoints...\n');
  
  try {
    await testAPI('/api/test');
    await testAPI('/api/models');
    await testAPI('/api/monitoring/user/stats');
    
    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTests();