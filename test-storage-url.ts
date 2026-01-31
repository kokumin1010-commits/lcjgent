import { storagePut } from "./server/storage";
import * as fs from "fs";

async function testStorageUrl() {
  // Read the test image
  const imageBuffer = fs.readFileSync("/home/ubuntu/upload/IMG_8048.PNG");
  
  // Upload to storage
  const key = `test-upload-${Date.now()}.png`;
  const result = await storagePut(key, imageBuffer, "image/png");
  
  console.log("Storage result:", result);
  console.log("URL:", result.url);
}

testStorageUrl().catch(console.error);
