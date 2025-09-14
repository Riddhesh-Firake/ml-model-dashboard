// Debug script to check what the API is actually returning
const http = require('http');

function debugAPI(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Debug-Script'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n=== ${path} ===`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);
        console.log(`Content-Length: ${res.headers['content-length']}`);
        console.log(`Response preview (first 200 chars):`);
        console.log(data.substring(0, 200));
        console.log(`Is HTML: ${data.includes('<!DOCTYPE html>')}`);
        console.log(`Is JSON: ${data.trim().startsWith('{') || data.trim().startsWith('[')}`);
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${path}: ${error.message}`);
      resolve();
    });

    req.end();
  });
}

async function runDebug() {
  console.log('🔍 Debugging API responses...');
  
  await debugAPI('/api/test');
  await debugAPI('/api/models');
  await debugAPI('/api/monitoring/user/stats');
  await debugAPI('/');
  
  console.log('\n✅ Debug complete!');
}

runDebug();