import App from './app';
import request from 'supertest';

async function testAuthentication() {
  console.log('🧪 Testing Authentication Endpoints...\n');

  const app = new App();
  const server = app.app;

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await request(server).get('/health');
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Response: ${JSON.stringify(healthResponse.body, null, 2)}\n`);

    // Test user registration
    console.log('2. Testing user registration...');
    const registerData = {
      email: 'test@example.com',
      password: 'StrongPass123!'
    };

    const registerResponse = await request(server)
      .post('/api/auth/register')
      .send(registerData);
    
    console.log(`   Status: ${registerResponse.status}`);
    console.log(`   Response: ${JSON.stringify(registerResponse.body, null, 2)}\n`);

    if (registerResponse.status === 201) {
      // Test user login
      console.log('3. Testing user login...');
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send(registerData);
      
      console.log(`   Status: ${loginResponse.status}`);
      console.log(`   Response: ${JSON.stringify(loginResponse.body, null, 2)}\n`);

      if (loginResponse.status === 200) {
        const token = loginResponse.body.token;

        // Test profile access
        console.log('4. Testing profile access...');
        const profileResponse = await request(server)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`);
        
        console.log(`   Status: ${profileResponse.status}`);
        console.log(`   Response: ${JSON.stringify(profileResponse.body, null, 2)}\n`);

        // Test API key regeneration
        console.log('5. Testing API key regeneration...');
        const apiKeyResponse = await request(server)
          .post('/api/auth/api-key/regenerate')
          .set('Authorization', `Bearer ${token}`);
        
        console.log(`   Status: ${apiKeyResponse.status}`);
        console.log(`   Response: ${JSON.stringify(apiKeyResponse.body, null, 2)}\n`);
      }
    }

    // Test validation errors
    console.log('6. Testing validation errors...');
    const invalidRegisterResponse = await request(server)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'weak'
      });
    
    console.log(`   Status: ${invalidRegisterResponse.status}`);
    console.log(`   Response: ${JSON.stringify(invalidRegisterResponse.body, null, 2)}\n`);

    console.log('✅ Authentication testing completed!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await app.close();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAuthentication().catch(console.error);
}

export { testAuthentication };