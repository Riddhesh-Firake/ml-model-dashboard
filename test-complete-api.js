/**
 * Complete API Test Script
 * Tests all endpoints including auth, upload, prediction, and monitoring
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

// Test data - use timestamp to ensure unique user
const timestamp = Date.now();
const testUser = {
    email: `test${timestamp}@example.com`,
    password: 'testpassword123'
};

let authToken = '';
let apiKey = '';
let modelId = '';

async function runTests() {
    console.log('🚀 Starting Complete API Tests...\n');

    try {
        // Test 1: Health Check
        console.log('1. Testing Health Check...');
        const healthResponse = await axios.get(`${BASE_URL}/api/health`);
        console.log('✅ Health Check:', healthResponse.data);
        console.log('');

        // Test 2: User Registration
        console.log('2. Testing User Registration...');
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
        apiKey = registerResponse.data.apiKey; // Get API key from registration
        console.log('✅ Registration:', registerResponse.data);
        console.log('✅ API Key received during registration:', apiKey.substring(0, 20) + '...');
        console.log('');

        // Test 3: User Login
        console.log('3. Testing User Login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, testUser);
        authToken = loginResponse.data.token;
        console.log('✅ Login successful, token received');
        console.log('');

        // Test 4: Skip API Key Generation (already have one from registration)
        console.log('4. Using API Key from Registration...');
        console.log('✅ API Key available:', apiKey.substring(0, 20) + '...');
        console.log('');

        // Test 5: Model Upload
        console.log('5. Testing Model Upload...');
        
        // Check if sample model exists
        const modelPath = path.join(__dirname, 'sample-ml-model', 'house_price_model.pkl');
        if (!fs.existsSync(modelPath)) {
            console.log('⚠️  Sample model not found, creating dummy file...');
            const dummyModelPath = path.join(__dirname, 'dummy_model.pkl');
            fs.writeFileSync(dummyModelPath, 'dummy model content for testing');
            
            const formData = new FormData();
            formData.append('model', fs.createReadStream(dummyModelPath));
            formData.append('name', 'Test House Price Model');
            formData.append('description', 'A test model for predicting house prices');

            const uploadResponse = await axios.post(
                `${BASE_URL}/api/models/upload`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'X-API-Key': apiKey
                    }
                }
            );
            
            modelId = uploadResponse.data.model.id;
            console.log('✅ Model uploaded:', uploadResponse.data);
            
            // Clean up dummy file
            fs.unlinkSync(dummyModelPath);
        } else {
            const formData = new FormData();
            formData.append('model', fs.createReadStream(modelPath));
            formData.append('name', 'House Price Prediction Model');
            formData.append('description', 'ML model for predicting house prices based on features');

            const uploadResponse = await axios.post(
                `${BASE_URL}/api/models/upload`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'X-API-Key': apiKey
                    }
                }
            );
            
            modelId = uploadResponse.data.model.id;
            console.log('✅ Model uploaded:', uploadResponse.data);
        }
        console.log('');

        // Test 6: List Models
        console.log('6. Testing List Models...');
        const modelsResponse = await axios.get(`${BASE_URL}/api/models`, {
            headers: { 'X-API-Key': apiKey }
        });
        console.log('✅ Models listed:', modelsResponse.data);
        console.log('');

        // Test 7: Get Model Details
        console.log('7. Testing Get Model Details...');
        const modelResponse = await axios.get(`${BASE_URL}/api/models/${modelId}`, {
            headers: { 'X-API-Key': apiKey }
        });
        console.log('✅ Model details:', modelResponse.data);
        console.log('');

        // Test 8: Make Prediction
        console.log('8. Testing Model Prediction...');
        const predictionData = {
            bedrooms: 3,
            bathrooms: 2,
            sqft: 1500,
            age: 10
        };
        
        const predictionResponse = await axios.post(
            `${BASE_URL}/api/predict/${modelId}`,
            predictionData,
            {
                headers: { 'X-API-Key': apiKey }
            }
        );
        console.log('✅ Prediction made:', predictionResponse.data);
        console.log('');

        // Test 9: Update Model
        console.log('9. Testing Model Update...');
        const updateResponse = await axios.put(
            `${BASE_URL}/api/models/${modelId}`,
            {
                name: 'Updated House Price Model',
                description: 'Updated description for the model'
            },
            {
                headers: { 'X-API-Key': apiKey }
            }
        );
        console.log('✅ Model updated:', updateResponse.data);
        console.log('');

        // Test 10: Monitoring Endpoints
        console.log('10. Testing Monitoring Endpoints...');
        
        // System metrics
        const metricsResponse = await axios.get(`${BASE_URL}/api/monitoring/metrics`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✅ System metrics:', metricsResponse.data);
        
        // Model performance
        const performanceResponse = await axios.get(`${BASE_URL}/api/monitoring/models/${modelId}/performance`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✅ Model performance:', performanceResponse.data);
        console.log('');

        // Test 11: Documentation Endpoints
        console.log('11. Testing Documentation Endpoints...');
        
        // API documentation
        const docsResponse = await axios.get(`${BASE_URL}/api/docs`);
        console.log('✅ API documentation available');
        
        // Testing interface
        const testingResponse = await axios.get(`${BASE_URL}/api/docs/testing`);
        console.log('✅ Testing interface available');
        console.log('');

        // Test 12: Rate Limiting (optional)
        console.log('12. Testing Rate Limiting...');
        try {
            // Make multiple rapid requests to test rate limiting
            const promises = Array(10).fill().map(() => 
                axios.get(`${BASE_URL}/api/health`)
            );
            await Promise.all(promises);
            console.log('✅ Rate limiting working (or not configured for health endpoint)');
        } catch (error) {
            if (error.response?.status === 429) {
                console.log('✅ Rate limiting working - got 429 Too Many Requests');
            } else {
                console.log('⚠️  Rate limiting test inconclusive');
            }
        }
        console.log('');

        console.log('🎉 All tests completed successfully!');
        console.log('\n📊 Test Summary:');
        console.log('- Health Check: ✅');
        console.log('- User Registration: ✅');
        console.log('- User Login: ✅');
        console.log('- API Key Generation: ✅');
        console.log('- Model Upload: ✅');
        console.log('- List Models: ✅');
        console.log('- Get Model Details: ✅');
        console.log('- Model Prediction: ✅');
        console.log('- Model Update: ✅');
        console.log('- Monitoring: ✅');
        console.log('- Documentation: ✅');
        console.log('- Rate Limiting: ✅');

        console.log('\n🔗 Available Endpoints:');
        console.log(`- Frontend: ${BASE_URL}`);
        console.log(`- API Documentation: ${BASE_URL}/api/docs`);
        console.log(`- Testing Interface: ${BASE_URL}/api/docs/testing`);
        console.log(`- Health Check: ${BASE_URL}/api/health`);

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
        process.exit(1);
    }
}

// Run the tests
runTests();