// Test login to get admin session
import fetch from 'node-fetch';

const BASE = 'http://localhost:3000';

async function main() {
  // Try to get admin user info from DB
  const res = await fetch(`${BASE}/api/trpc/auth.me`, {
    headers: { 'Content-Type': 'application/json' },
  });
  console.log('Auth check status:', res.status);
  const body = await res.text();
  console.log('Auth check body:', body.substring(0, 200));
}

main().catch(console.error);
