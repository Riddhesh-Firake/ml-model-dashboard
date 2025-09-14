async function checkRoutes() {
  const routes = [
    'http://localhost:3000/',
    'http://localhost:3000/api/auth',
    'http://localhost:3000/api/auth/register',
    'http://localhost:3000/api/auth/login'
  ];
  
  for (const route of routes) {
    try {
      console.log(`\nTesting: ${route}`);
      const response = await fetch(route);
      const text = await response.text();
      console.log(`Status: ${response.status}`);
      console.log(`Response: ${text.substring(0, 200)}...`);
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
}

checkRoutes();