import { spawn } from 'child_process';

const child = spawn('npx', ['drizzle-kit', 'generate'], {
  cwd: '/home/ubuntu/task-automation-agent',
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let output = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // Auto-select first option (create table) by pressing Enter
  if (text.includes('create table') || text.includes('renamed from')) {
    setTimeout(() => {
      child.stdin.write('\n');
    }, 200);
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stderr.write(text);
  
  if (text.includes('create table') || text.includes('renamed from')) {
    setTimeout(() => {
      child.stdin.write('\n');
    }, 200);
  }
});

child.on('close', (code) => {
  console.log(`\n--- Process exited with code ${code} ---`);
  
  // Now run migrate
  if (code === 0) {
    console.log('\n--- Running drizzle-kit migrate ---');
    const migrate = spawn('npx', ['drizzle-kit', 'migrate'], {
      cwd: '/home/ubuntu/task-automation-agent',
      stdio: 'inherit',
      env: { ...process.env }
    });
    migrate.on('close', (c) => {
      console.log(`\n--- Migrate exited with code ${c} ---`);
    });
  }
});
