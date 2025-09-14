const http = require('http');

function testAPI(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
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
                
                try {
                    const parsed = JSON.parse(data);
                    console.log('Response (JSON):', JSON.stringify(parsed, null, 2));
                } catch (e) {
                    console.log('Response (Text):', data.substring(0, 200));
                    console.log('Is HTML?', data.includes('<!DOCTYPE html>'));
                }
                
                resolve({ status: res.statusCode, data, contentType: res.headers['content-type'] });
            });
        });

        req.on('error', (err) => {
            console.error(`Error testing ${path}:`, err.message);
            reject(err);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function runTests() {
    console.log('Testing API endpoints...');
    
    const endpoints = [
        '/api/test',
        '/api/models',
        '/api/monitoring/user/stats',
        '/health'
    ];
    
    for (const endpoint of endpoints) {
        try {
            await testAPI(endpoint);
        } catch (error) {
            console.error(`Failed to test ${endpoint}:`, error.message);
        }
    }
    
    console.log('\n=== Test Complete ===');
}

runTests();