const http = require('http');
const fs = require('fs');
const path = require('path');

// Create a simple test file
const testFilePath = 'test-model.pkl';
const testFileContent = 'This is a test pickle file for upload testing.';
fs.writeFileSync(testFilePath, testFileContent);

function createMultipartData(fields, files) {
    const boundary = '----formdata-boundary-' + Math.random().toString(36);
    let data = '';
    
    // Add form fields
    for (const [key, value] of Object.entries(fields)) {
        data += `--${boundary}\r\n`;
        data += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        data += `${value}\r\n`;
    }
    
    // Add files
    for (const [key, filePath] of Object.entries(files)) {
        const fileContent = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        data += `--${boundary}\r\n`;
        data += `Content-Disposition: form-data; name="${key}"; filename="${fileName}"\r\n`;
        data += `Content-Type: application/octet-stream\r\n\r\n`;
        data += fileContent;
        data += '\r\n';
    }
    
    data += `--${boundary}--\r\n`;
    
    return {
        data: Buffer.from(data, 'binary'),
        boundary: boundary
    };
}

function testUpload() {
    return new Promise((resolve, reject) => {
        const fields = {
            modelName: 'Test Model',
            description: 'A test model for upload testing'
        };
        
        const files = {
            modelFile: testFilePath
        };
        
        const multipart = createMultipartData(fields, files);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/models/upload',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
                'Content-Length': multipart.data.length
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`\n=== Upload Test Results ===`);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Content-Type: ${res.headers['content-type']}`);
                
                try {
                    const parsed = JSON.parse(data);
                    console.log('Response (JSON):', JSON.stringify(parsed, null, 2));
                    
                    if (parsed.modelId && parsed.endpointUrl) {
                        console.log('✅ Upload successful!');
                        console.log(`Model ID: ${parsed.modelId}`);
                        console.log(`Endpoint URL: ${parsed.endpointUrl}`);
                    } else {
                        console.log('⚠️ Upload response missing expected fields');
                    }
                } catch (e) {
                    console.log('Response (Text):', data);
                }
                
                resolve({ status: res.statusCode, data });
            });
        });

        req.on('error', (err) => {
            console.error(`Upload test failed:`, err.message);
            reject(err);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(multipart.data);
        req.end();
    });
}

async function runTest() {
    console.log('Testing model upload endpoint...');
    
    try {
        await testUpload();
    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    }
    
    console.log('\n=== Test Complete ===');
}

runTest();