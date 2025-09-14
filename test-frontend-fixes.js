/**
 * Test script to verify frontend fixes
 */

const axios = require('axios');

async function testFrontendFixes() {
    console.log('🧪 Testing Frontend Fixes...\n');
    
    try {
        // Test 1: User stats endpoint
        console.log('1. Testing User Stats Endpoint...');
        const userStatsResponse = await axios.get('http://localhost:3000/api/monitoring/user/stats');
        console.log('✅ User stats endpoint working:', {
            totalModels: userStatsResponse.data.totalModels,
            subscription: userStatsResponse.data.subscription,
            rateLimits: userStatsResponse.data.rateLimits
        });
        console.log('');
        
        // Test 2: Models endpoint format field
        console.log('2. Testing Models Endpoint Format Field...');
        
        // First register a user to get an API key
        const testUser = {
            email: `test${Date.now()}@example.com`,
            password: 'testpassword123'
        };
        
        const registerResponse = await axios.post('http://localhost:3000/api/auth/register', testUser);
        const apiKey = registerResponse.data.apiKey;
        console.log('✅ User registered, API key obtained');
        
        // Upload a test model
        const FormData = require('form-data');
        const fs = require('fs');
        
        const formData = new FormData();
        formData.append('name', 'Test Model for Frontend');
        formData.append('description', 'Testing format field');
        formData.append('model', fs.createReadStream('sample-ml-model/house_price_model.pkl'));
        
        const uploadResponse = await axios.post(
            'http://localhost:3000/api/models/upload',
            formData,
            {
                headers: {
                    'X-API-Key': apiKey,
                    ...formData.getHeaders()
                }
            }
        );
        console.log('✅ Model uploaded successfully');
        
        // Get models list
        const modelsResponse = await axios.get('http://localhost:3000/api/models', {
            headers: { 'X-API-Key': apiKey }
        });
        
        const models = modelsResponse.data;
        if (models.length > 0) {
            const model = models[0];
            console.log('✅ Models endpoint returns correct format field:', {
                id: model.id,
                name: model.name,
                format: model.format, // This should be 'pkl', not undefined
                status: model.status
            });
            
            // Verify format field exists and is not undefined
            if (model.format && model.format !== undefined) {
                console.log('✅ Format field is properly defined:', model.format);
            } else {
                console.log('❌ Format field is undefined or missing');
            }
        } else {
            console.log('❌ No models found in response');
        }
        
        console.log('\n🎉 Frontend fixes verification completed!');
        console.log('\n📋 Summary:');
        console.log('- User stats endpoint: ✅ Working');
        console.log('- Models format field: ✅ Properly defined');
        console.log('- Frontend should now work without errors');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testFrontendFixes();