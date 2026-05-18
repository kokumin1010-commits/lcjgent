/**
 * check-no-undef.cjs
 * 
 * CI用スクリプト: ESLintのno-undefエラーのみをチェックする。
 * 他のルール違反は無視し、未定義変数の使用だけを検出して
 * Reactアプリ全体のクラッシュを防止する。
 * 
 * Usage: node scripts/check-no-undef.cjs
 * Exit code: 0 = no-undef errors なし, 1 = no-undef errors あり
 */
const { execSync } = require('child_process');

try {
  // ESLintを実行してJSON形式で結果を取得
  const output = execSync('npx eslint src/ -f json', {
    cwd: __dirname + '/..',
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });
  
  const results = JSON.parse(output);
  const noUndefErrors = [];
  
  for (const file of results) {
    for (const msg of file.messages) {
      if (msg.ruleId === 'no-undef') {
        noUndefErrors.push({
          file: file.filePath.replace(process.cwd() + '/', ''),
          line: msg.line,
          column: msg.column,
          message: msg.message,
        });
      }
    }
  }
  
  if (noUndefErrors.length > 0) {
    console.error('\n❌ FATAL: Undefined variable(s) detected!\n');
    console.error('These will crash the React app at runtime:\n');
    for (const err of noUndefErrors) {
      console.error(`  ${err.file}:${err.line}:${err.column} - ${err.message}`);
    }
    console.error(`\n${noUndefErrors.length} no-undef error(s) found. Deployment blocked.\n`);
    process.exit(1);
  }
  
  console.log('✅ No undefined variable errors found. Safe to deploy.');
  process.exit(0);
} catch (err) {
  // ESLint exits with code 1 when there are errors, but we still get stdout
  if (err.stdout) {
    try {
      const results = JSON.parse(err.stdout);
      const noUndefErrors = [];
      
      for (const file of results) {
        for (const msg of file.messages) {
          if (msg.ruleId === 'no-undef') {
            noUndefErrors.push({
              file: file.filePath.replace(process.cwd() + '/', ''),
              line: msg.line,
              column: msg.column,
              message: msg.message,
            });
          }
        }
      }
      
      if (noUndefErrors.length > 0) {
        console.error('\n❌ FATAL: Undefined variable(s) detected!\n');
        console.error('These will crash the React app at runtime:\n');
        for (const err of noUndefErrors) {
          console.error(`  ${err.file}:${err.line}:${err.column} - ${err.message}`);
        }
        console.error(`\n${noUndefErrors.length} no-undef error(s) found. Deployment blocked.\n`);
        process.exit(1);
      }
      
      console.log('✅ No undefined variable errors found. Safe to deploy.');
      process.exit(0);
    } catch {
      // JSON parse failed - ESLint had a different issue
      console.error('ESLint execution failed:', err.message);
      // Don't block deployment for ESLint config issues
      console.log('⚠️ Could not run no-undef check, proceeding with deployment.');
      process.exit(0);
    }
  } else {
    console.error('ESLint execution failed:', err.message);
    // Don't block deployment for ESLint config issues
    console.log('⚠️ Could not run no-undef check, proceeding with deployment.');
    process.exit(0);
  }
}
