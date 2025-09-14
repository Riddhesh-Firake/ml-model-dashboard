const http = require('http');

function testAuthEndpoint(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        if (data) {
            const postData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                console.log(`\n=== Testing ${method} ${path} ===`);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Content-Type: ${res.headers['content-type']}`);
                
                try {
                    const parsed = JSON.parse(responseData);
                    console.log('Response (JSON):', JSON.stringify(parsed, null, 2));
                } catch (e) {
                    console.log('Response (Text):', responseData.substring(0, 200));
                    console.log('Is HTML?', responseData.includes('<!DOCTYPE html>'));
                }
                
                resolve({ status: res.statusCode, data: responseData, contentType: res.headers['content-type'] });
            });
        });

        req.on('error', (err) => {
            console.error(`Error testing ${method} ${path}:`, err.message);
            reject(err);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runAuthTests() {
    console.log('Testing auth endpoints...');
    
    try {
        // Test registration endpoint
        await testAuthEndpoint('POST', '/api/auth/register', {
            email: 'test@example.com',
            password: 'testpassword123'
        });
        
        // Test login endpoint
        await testAuthEndpoint('POST', '/api/auth/login', {
            email: 'test@example.com',
            password: 'testpassword123'
        });
        
    } catch (error) {
        console.error('Auth test failed:', error.message);
    }
    
    console.log('\n=== Auth Test Complete ===');
}

runAuthTests();