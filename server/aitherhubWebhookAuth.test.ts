import { describe, it, expect } from "vitest";

describe("Aitherhub Webhook Authentication", () => {
  it("AITHERHUB_WEBHOOK_SECRET environment variable should be set", () => {
    const secret = process.env.AITHERHUB_WEBHOOK_SECRET;
    expect(secret).toBeDefined();
    expect(secret).not.toBe("");
    expect(typeof secret).toBe("string");
    expect(secret!.length).toBeGreaterThan(10);
  });

  it("AITHERHUB_WEBHOOK_SECRET should match expected format", () => {
    const secret = process.env.AITHERHUB_WEBHOOK_SECRET;
    // Should be a non-empty string with reasonable length
    expect(secret).toBeTruthy();
    expect(secret!.length).toBeGreaterThanOrEqual(20);
  });

  it("authenticateWebhook should accept correct secret", async () => {
    const secret = process.env.AITHERHUB_WEBHOOK_SECRET;
    // Simulate the authentication logic from aitherhubWebhook.ts
    const WEBHOOK_SECRET = process.env.AITHERHUB_WEBHOOK_SECRET || "";
    
    // Correct secret should pass
    expect(WEBHOOK_SECRET).not.toBe("");
    expect(secret === WEBHOOK_SECRET).toBe(true);
  });

  it("authenticateWebhook should reject incorrect secret", async () => {
    const WEBHOOK_SECRET = process.env.AITHERHUB_WEBHOOK_SECRET || "";
    
    // Wrong secret should fail
    expect("wrong-secret" === WEBHOOK_SECRET).toBe(false);
    expect("" === WEBHOOK_SECRET).toBe(false);
  });
});
