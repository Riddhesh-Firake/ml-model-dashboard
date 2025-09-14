async function testRegistration() {
  try {
    console.log('Testing user registration...');
    
    const response = await fetch('http://localhost:3000/api/auth/register', {
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
      console.log('Response:', data);
    } else {
      console.error('❌ Registration failed:');
      console.error('Status:', response.status);
      console.error('Data:', data);
    }
    
  } catch (error) {
    console.error('❌ Registration failed:');
    console.error('Error:', error.message);
  }
}

testRegistration();