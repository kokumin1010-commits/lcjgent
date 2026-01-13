import { drizzle } from "drizzle-orm/mysql2";
import { staff, tasks } from "./drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

async function createTestData() {
  console.log("Creating test data...");
  
  // Create test staff
  const staffResult = await db.insert(staff).values({
    name: "テスト担当者",
    email: "ryuhairartist@gmail.com",
    department: "テスト部門",
    isActive: "active",
  });
  
  const staffId = Number(staffResult[0].insertId);
  console.log("Created staff with ID:", staffId);
  
  // Create test task
  const taskResult = await db.insert(tasks).values({
    taskId: `TASK-TEST-${Date.now()}`,
    staffId: staffId,
    taskDetail: "これはリマインドメールのテストタスクです。担当者への自動リマインド機能が正常に動作するかを確認します。",
    extractedContext: "テストコンテキスト: 12時間ごとの自動リマインド送信機能のテスト",
    status: "in_progress",
    startDate: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days ago
    createdBy: 1,
  });
  
  const taskId = Number(taskResult[0].insertId);
  console.log("Created task with ID:", taskId);
  
  console.log("Test data created successfully!");
  process.exit(0);
}

createTestData().catch((error) => {
  console.error("Error creating test data:", error);
  process.exit(1);
});
