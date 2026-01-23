import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { eq } from "drizzle-orm";

// Create a mock context for testing
function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("Liver Authentication API", () => {
  const testEmail = `test-liver-${Date.now()}@example.com`;
  const testPassword = "testpassword123";
  const testName = "Test Liver";
  let testLiverId: number;

  afterAll(async () => {
    // Clean up test data
    const db = await getDb();
    if (db) {
      // Delete test liver by email using raw SQL
      try {
        await db.execute({
          sql: "DELETE FROM livers WHERE email = ?",
          args: [testEmail],
        } as any);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  it("should register a new liver account", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.liver.register({
      name: testName,
      email: testEmail,
      password: testPassword,
      color: "#FF69B4",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.liver).toBeDefined();
    expect(result.liver.name).toBe(testName);
    expect(result.liver.email).toBe(testEmail);
    expect(result.liver.color).toBe("#FF69B4");
    
    testLiverId = result.liver.id;
  });

  it("should prevent duplicate email registration", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.liver.register({
        name: "Another Liver",
        email: testEmail,
        password: "anotherpassword",
        color: "#3498DB",
      })
    ).rejects.toThrow();
  });

  it("should login with correct credentials", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.liver.login({
      email: testEmail,
      password: testPassword,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.liver).toBeDefined();
    expect(result.liver.name).toBe(testName);
    expect(result.liver.email).toBe(testEmail);
  });

  it("should reject login with incorrect password", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.liver.login({
        email: testEmail,
        password: "wrongpassword",
      })
    ).rejects.toThrow();
  });

  it("should reject login with non-existent email", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.liver.login({
        email: "nonexistent@example.com",
        password: testPassword,
      })
    ).rejects.toThrow();
  });


});
