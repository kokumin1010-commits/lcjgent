import { spawn } from 'child_process';

const child = spawn('npx', ['drizzle-kit', 'generate'], {
  cwd: '/home/ubuntu/task-automation-agent',
  stdio: ['pipe', 'pipe', 'pipe'],
});

let output = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // Auto-select "create table" for every prompt
  if (text.includes('create table') || text.includes('created or renamed')) {
    setTimeout(() => {
      child.stdin.write('\n');
    }, 200);
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
});
