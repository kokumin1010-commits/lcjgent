import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-indexnow-user",
    email: "indexnow-test@example.com",
    name: "IndexNow Test User",
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

describe("IndexNow Auto-Trigger on Publish", () => {
  const caller = appRouter.createCaller(createAuthContext());
  let testArticleId: number;
  const testSlug = `indexnow-test-${Date.now()}`;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on global fetch to detect IndexNow calls
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    // Set APP_URL for IndexNow trigger
    process.env.APP_URL = "https://test.example.com";
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.APP_URL;
  });

  it("should trigger IndexNow when creating article as published", async () => {
    const article = await caller.blog.create({
      title: "IndexNow Auto Test - Published",
      slug: testSlug,
      status: "published",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test content" }] }] },
    });
    testArticleId = article.id;
    expect(article.id).toBeGreaterThan(0);

    // Check that fetch was called with IndexNow endpoint
    const indexNowCalls = fetchSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/api/indexnow/submit")
    );
    expect(indexNowCalls.length).toBeGreaterThanOrEqual(1);

    // Verify the URL contains the article slug
    const body = JSON.parse((indexNowCalls[0][1] as any).body);
    expect(body.urls[0]).toContain(testSlug);

    // Cleanup
    await caller.blog.delete({ id: testArticleId });
  });

  it("should NOT trigger IndexNow when creating article as draft", async () => {
    const article = await caller.blog.create({
      title: "IndexNow Auto Test - Draft",
      slug: `draft-${testSlug}`,
      status: "draft",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Draft content" }] }] },
    });

    // Check that no IndexNow calls were made
    const indexNowCalls = fetchSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/api/indexnow/submit")
    );
    expect(indexNowCalls.length).toBe(0);

    // Cleanup
    await caller.blog.delete({ id: article.id });
  });

  it("should trigger IndexNow when updating article status to published", async () => {
    // Create as draft first
    const article = await caller.blog.create({
      title: "IndexNow Update Test",
      slug: `update-${testSlug}`,
      status: "draft",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Content" }] }] },
    });

    // Clear previous fetch calls
    fetchSpy.mockClear();

    // Update status to published
    await caller.blog.update({
      id: article.id,
      status: "published",
    });

    // Check that IndexNow was triggered
    const indexNowCalls = fetchSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/api/indexnow/submit")
    );
    expect(indexNowCalls.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    await caller.blog.delete({ id: article.id });
  });

  it("should trigger IndexNow when toggling from draft to published", async () => {
    // Create as draft
    const article = await caller.blog.create({
      title: "IndexNow Toggle Test",
      slug: `toggle-${testSlug}`,
      status: "draft",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Content" }] }] },
    });

    // Clear previous fetch calls
    fetchSpy.mockClear();

    // Toggle publish
    const result = await caller.blog.togglePublish({ id: article.id });
    expect(result.status).toBe("published");

    // Check that IndexNow was triggered
    const indexNowCalls = fetchSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/api/indexnow/submit")
    );
    expect(indexNowCalls.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    await caller.blog.delete({ id: article.id });
  });

  it("should NOT trigger IndexNow when updating non-status fields", async () => {
    const article = await caller.blog.create({
      title: "IndexNow No Trigger Test",
      slug: `notrigger-${testSlug}`,
      status: "draft",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Content" }] }] },
    });

    // Clear previous fetch calls
    fetchSpy.mockClear();

    // Update title only (no status change)
    await caller.blog.update({
      id: article.id,
      title: "Updated Title",
    });

    // Check that NO IndexNow calls were made
    const indexNowCalls = fetchSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/api/indexnow/submit")
    );
    expect(indexNowCalls.length).toBe(0);

    // Cleanup
    await caller.blog.delete({ id: article.id });
  });

  it("should not crash if IndexNow fetch fails", async () => {
    // Make fetch throw an error
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw even if IndexNow fails
    const article = await caller.blog.create({
      title: "IndexNow Error Test",
      slug: `error-${testSlug}`,
      status: "published",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Content" }] }] },
    });

    expect(article.id).toBeGreaterThan(0);

    // Cleanup
    await caller.blog.delete({ id: article.id });
  });
});
