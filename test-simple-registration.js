// Test registration with simple server
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testSimpleRegistration() {
  try {
    console.log('Testing registration with simple server...');
    
    const response = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Registration successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Registration failed:');
      console.error('Status:', response.status);
      console.error('Data:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Registration failed:');
    console.error('Error:', error.message);
  }
}

testSimpleRegistration();