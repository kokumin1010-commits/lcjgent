import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, logBrandEdit, getBrandEditLogs } from "./db";
import { brandEditLogs, brands } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Edit Log Functions", () => {
  let testBrandId: number;
  let testLogIds: number[] = [];

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test brand
    const result = await db.insert(brands).values({
      name: "Test Brand for Edit Log",
      nameJa: "テストブランド",
      status: "進行中",
      createdBy: 999,
    });
    testBrandId = Number(result[0].insertId);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up test logs
    for (const logId of testLogIds) {
      await db.delete(brandEditLogs).where(eq(brandEditLogs.id, logId));
    }

    // Clean up test brand
    if (testBrandId) {
      await db.delete(brands).where(eq(brands.id, testBrandId));
    }
  });

  it("should create an edit log for product creation", async () => {
    const log = await logBrandEdit(
      testBrandId,
      "create",
      "product",
      1001,
      "Test Product",
      "商品を追加：Test Product",
      999,
      "Test User"
    );

    expect(log).toBeDefined();
    expect(log.id).toBeGreaterThan(0);
    testLogIds.push(log.id);
  });

  it("should create an edit log for product update", async () => {
    const log = await logBrandEdit(
      testBrandId,
      "update",
      "product",
      1001,
      "Test Product",
      "商品を編集：Test Product",
      999,
      "Test User"
    );

    expect(log).toBeDefined();
    expect(log.id).toBeGreaterThan(0);
    testLogIds.push(log.id);
  });

  it("should create an edit log for livestream creation", async () => {
    const log = await logBrandEdit(
      testBrandId,
      "create",
      "livestream",
      2001,
      "2026/01/27 @ryukyogoku",
      "ライブ配信を追加：2026/01/27 @ryukyogoku",
      999,
      "Test User"
    );

    expect(log).toBeDefined();
    expect(log.id).toBeGreaterThan(0);
    testLogIds.push(log.id);
  });

  it("should create an edit log for contract creation", async () => {
    const log = await logBrandEdit(
      testBrandId,
      "create",
      "contract",
      3001,
      "単発ライブ契約 ¥500,000",
      "契約を追加：単発ライブ契約 ¥500,000",
      999,
      "Test User"
    );

    expect(log).toBeDefined();
    expect(log.id).toBeGreaterThan(0);
    testLogIds.push(log.id);
  });

  it("should retrieve edit logs for a brand", async () => {
    const logs = await getBrandEditLogs(testBrandId, 50);

    expect(logs).toBeDefined();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(4);

    // Verify logs are ordered by createdAt desc (most recent first)
    for (let i = 1; i < logs.length; i++) {
      const prevTime = new Date(logs[i - 1].createdAt).getTime();
      const currTime = new Date(logs[i].createdAt).getTime();
      expect(prevTime).toBeGreaterThanOrEqual(currTime);
    }
  });

  it("should limit the number of edit logs returned", async () => {
    const logs = await getBrandEditLogs(testBrandId, 2);

    expect(logs).toBeDefined();
    expect(logs.length).toBeLessThanOrEqual(2);
  });

  it("should return correct log structure", async () => {
    const logs = await getBrandEditLogs(testBrandId, 1);

    expect(logs.length).toBeGreaterThan(0);
    const log = logs[0];
    
    expect(log).toHaveProperty("id");
    expect(log).toHaveProperty("brandId");
    expect(log).toHaveProperty("actionType");
    expect(log).toHaveProperty("entityType");
    expect(log).toHaveProperty("entityId");
    expect(log).toHaveProperty("entityName");
    expect(log).toHaveProperty("changeDescription");
    expect(log).toHaveProperty("userId");
    expect(log).toHaveProperty("userName");
    expect(log).toHaveProperty("createdAt");
  });
});
