import { SignJWT } from 'jose';

// JWT_SECRETが空の場合のデフォルト値を確認
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");

const token = await new SignJWT({ liverId: 120005, type: "liver" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("10y")
  .sign(secret);

console.log("Token:", token);

// Test with curl
console.log("\nTest command:");
console.log(`curl -s -H "Authorization: Bearer ${token}" "https://lcjmall.com/api/trpc/sampleRequest.getMyCredit?input=%7B%7D"`);
