/**
 * Quick script to get a Bearer token for testing
 * Run this in Node.js or browser console to get authentication token
 */

async function getBearerToken() {
    const baseUrl = 'http://localhost:3000';
    
    try {
        console.log('🔐 Getting Bearer token for API testing...');
        
        // Generate unique email for testing
        const testEmail = `test-${Date.now()}@example.com`;
        const testPassword = 'TestPassword123!';
        
        console.log(`📧 Using email: ${testEmail}`);
        
        // Register new user
        const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        
        if (!registerResponse.ok) {
            throw new Error(`Registration failed: ${registerResponse.status} ${registerResponse.statusText}`);
        }
        
        const registerData = await registerResponse.json();
        
        if (registerData.token) {
            console.log('✅ Registration successful!');
            console.log('🎯 Bearer Token:', registerData.token);
            console.log('\n📋 Copy this for Postman Authorization header:');
            console.log(`Bearer ${registerData.token}`);
            
            // Test the token by making a request
            console.log('\n🧪 Testing token with models endpoint...');
            const testResponse = await fetch(`${baseUrl}/api/models`, {
                headers: {
                    'Authorization': `Bearer ${registerData.token}`
                }
            });
            
            if (testResponse.ok) {
                console.log('✅ Token is valid and working!');
            } else {
                console.log('⚠️ Token test failed:', testResponse.status);
            }
            
            return registerData.token;
        } else {
            throw new Error('No token received from registration');
        }
        
    } catch (error) {
        console.error('❌ Error getting Bearer token:', error.message);
        
        // Try with existing user as fallback
        console.log('\n🔄 Trying with existing test user...');
        try {
            const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'TestPassword123!'
                })
            });
            
            if (loginResponse.ok) {
                const loginData = await loginResponse.json();
                if (loginData.token) {
                    console.log('✅ Login successful!');
                    console.log('🎯 Bearer Token:', loginData.token);
                    console.log('\n📋 Copy this for Postman Authorization header:');
                    console.log(`Bearer ${loginData.token}`);
                    return loginData.token;
                }
            }
        } catch (loginError) {
            console.error('❌ Login also failed:', loginError.message);
        }
        
        return null;
    }
}

async function testPredictionEndpoint(token, modelId = '335358cb-1193-4300-baa3-6b29254e2421') {
    const baseUrl = 'http://localhost:3000';
    
    console.log('\n🔮 Testing prediction endpoint...');
    console.log(`📍 Model ID: ${modelId}`);
    
    const testData = {
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1500,
        age: 10
    };
    
    try {
        const response = await fetch(`${baseUrl}/api/predict/${modelId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(testData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Prediction successful!');
            console.log('📊 Result:', JSON.stringify(result, null, 2));
        } else {
            console.log('❌ Prediction failed:', response.status);
            console.log('📄 Error:', JSON.stringify(result, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Prediction request failed:', error.message);
    }
}

// Main execution
async function main() {
    console.log('🚀 ML Model API Token Generator\n');
    
    const token = await getBearerToken();
    
    if (token) {
        console.log('\n' + '='.repeat(60));
        console.log('📝 POSTMAN SETUP INSTRUCTIONS:');
        console.log('='.repeat(60));
        console.log('1. Open Postman');
        console.log('2. Create new request: POST');
        console.log('3. URL: http://localhost:3000/api/predict/335358cb-1193-4300-baa3-6b29254e2421');
        console.log('4. Headers:');
        console.log('   - Content-Type: application/json');
        console.log(`   - Authorization: Bearer ${token}`);
        console.log('5. Body (raw JSON):');
        console.log('   {');
        console.log('     "bedrooms": 3,');
        console.log('     "bathrooms": 2,');
        console.log('     "sqft": 1500,');
        console.log('     "age": 10');
        console.log('   }');
        console.log('6. Click Send!');
        console.log('='.repeat(60));
        
        // Test the prediction endpoint
        await testPredictionEndpoint(token);
    }
}

// Run if in Node.js environment
if (typeof window === 'undefined') {
    main().catch(console.error);
}

// Export for browser use
if (typeof window !== 'undefined') {
    window.getBearerToken = getBearerToken;
    window.testPredictionEndpoint = testPredictionEndpoint;
    window.runTokenGenerator = main;
    
    console.log('🌐 Browser environment detected!');
    console.log('💡 Run: runTokenGenerator() to get your Bearer token');
}