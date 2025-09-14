// Debug script to check app startup issues
const { spawn } = require('child_process');

console.log('Starting server with debug output...');

const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true
});

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Kill after 10 seconds
setTimeout(() => {
  console.log('Killing server process...');
  server.kill();
}, 10000);