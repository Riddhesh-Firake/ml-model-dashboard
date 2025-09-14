// Debug server startup to see what's happening
const { spawn } = require('child_process');

console.log('Starting server with full debug output...');

const server = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error('Server startup error:', error);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Kill after 15 seconds to see startup logs
setTimeout(() => {
  console.log('\nKilling server process...');
  server.kill('SIGTERM');
  setTimeout(() => {
    server.kill('SIGKILL');
  }, 2000);
}, 15000);