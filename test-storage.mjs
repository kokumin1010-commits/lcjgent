import { storagePut } from './server/storage.ts';

const testBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

try {
  console.log('Testing storagePut...');
  const result = await storagePut('test/upload-test.png', testBuffer, 'image/png');
  console.log('SUCCESS:', JSON.stringify(result));
} catch (e) {
  console.log('ERROR:', e.message);
  console.log('STACK:', e.stack);
}
process.exit(0);
