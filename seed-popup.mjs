import { createRequire } from 'module';

// Use tsx to run TypeScript
const { execSync } = await import('child_process');

const result = execSync(`npx tsx -e "
import { seedPopupVariants } from './server/db.ts';
seedPopupVariants().then(r => { console.log(JSON.stringify(r)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"`, { cwd: '/home/ubuntu/task-automation-agent', encoding: 'utf-8', timeout: 30000 });

console.log(result);
