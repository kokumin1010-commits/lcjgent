import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@example.com",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: { origin: "https://localhost:3000" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

const caller = appRouter.createCaller(createAuthContext());

describe("Step Email - Templates", () => {
  it("listTemplates returns an array", async () => {
    const templates = await caller.stepEmail.listTemplates();
    expect(Array.isArray(templates)).toBe(true);
  });

  it("seedDefaults creates default templates", async () => {
    const result = await caller.stepEmail.seedDefaults();
    expect(result).toHaveProperty("seeded");
    expect(result).toHaveProperty("count");
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it("createTemplate creates a new template", async () => {
    const result = await caller.stepEmail.createTemplate({
      name: "テスト: ウェルカムメール",
      subject: "ようこそ！",
      bodyHtml: "<h1>テスト</h1>",
      bodyText: "テスト",
      delayDays: 0,
      sortOrder: 99,
      isEnabled: true,
    });
    expect(result).toHaveProperty("success", true);
  });

  it("updateTemplate modifies an existing template", async () => {
    // Get templates list to find one to update
    const templates = await caller.stepEmail.listTemplates();
    if (templates.length === 0) {
      // Create one first
      await caller.stepEmail.createTemplate({
        name: "更新テスト用",
        subject: "Before",
        bodyHtml: "<p>before</p>",
        bodyText: "before",
        delayDays: 1,
        sortOrder: 100,
        isEnabled: true,
      });
    }
    const allTemplates = await caller.stepEmail.listTemplates();
    const target = allTemplates[allTemplates.length - 1];

    const updated = await caller.stepEmail.updateTemplate({
      id: target.id,
      subject: "After Update",
      isEnabled: false,
    });
    expect(updated).toHaveProperty("success", true);
  });

  it("deleteTemplate removes a template", async () => {
    // Create one first
    await caller.stepEmail.createTemplate({
      name: "削除テスト用",
      subject: "Delete me",
      bodyHtml: "<p>delete</p>",
      bodyText: "delete",
      delayDays: 2,
      sortOrder: 101,
      isEnabled: false,
    });
    // Get the latest template to delete
    const allTemplates = await caller.stepEmail.listTemplates();
    const target = allTemplates[allTemplates.length - 1];

    const result = await caller.stepEmail.deleteTemplate({ id: target.id });
    expect(result).toHaveProperty("success", true);
  });
});

describe("Step Email - Logs", () => {
  it("getLogs returns paginated results", async () => {
    const result = await caller.stepEmail.getLogs({ page: 1, limit: 10 });
    expect(result).toHaveProperty("logs");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page", 1);
    expect(result).toHaveProperty("limit", 10);
    expect(Array.isArray(result.logs)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("getLogs supports status filter", async () => {
    const result = await caller.stepEmail.getLogs({ page: 1, limit: 10, status: "sent" });
    expect(result).toHaveProperty("logs");
    expect(Array.isArray(result.logs)).toBe(true);
  });

  it("getLogs supports search filter", async () => {
    const result = await caller.stepEmail.getLogs({ page: 1, limit: 10, search: "test@example.com" });
    expect(result).toHaveProperty("logs");
    expect(Array.isArray(result.logs)).toBe(true);
  });
});

describe("Step Email - Analytics", () => {
  it("getAnalytics returns overall and per-template data", async () => {
    const result = await caller.stepEmail.getAnalytics();
    expect(result).toHaveProperty("overall");
    expect(result).toHaveProperty("perTemplate");
    expect(result).toHaveProperty("dailyTrend");
    expect(Array.isArray(result.perTemplate)).toBe(true);
    expect(Array.isArray(result.dailyTrend)).toBe(true);
  });
});

describe("Step Email - Trigger", () => {
  it("triggerSend executes without error", async () => {
    const result = await caller.stepEmail.triggerSend();
    expect(result).toHaveProperty("message");
    expect(typeof result.message).toBe("string");
  });
});
