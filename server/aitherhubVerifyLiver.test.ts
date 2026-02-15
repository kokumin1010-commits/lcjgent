import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getLiverByEmail: vi.fn(),
  createBrandLivestream: vi.fn(),
  updateBrandLivestream: vi.fn(),
  getLivestreamsByLiverId: vi.fn(),
  createAitherhubSyncLog: vi.fn(),
}));

import { getLiverByEmail } from "./db";

describe("Aitherhub Verify Liver Endpoint", () => {
  const WEBHOOK_SECRET = process.env.AITHERHUB_WEBHOOK_SECRET || "INojMr8MomBZcQcMILyPLH-WA1sBbbq7lWmVuo7PHMc";

  // Helper to create mock request/response
  function createMockReqRes(body: any) {
    const req = { body } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    return { req, res };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject request with wrong secret", async () => {
    const { handleVerifyLiver } = await import("./aitherhubWebhook");
    const { req, res } = createMockReqRes({
      secret: "wrong-secret",
      email: "test@example.com",
    });

    await handleVerifyLiver(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("should reject request without email", async () => {
    const { handleVerifyLiver } = await import("./aitherhubWebhook");
    const { req, res } = createMockReqRes({
      secret: WEBHOOK_SECRET,
    });

    await handleVerifyLiver(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "email is required" });
  });

  it("should return found: false for non-existent liver", async () => {
    const { handleVerifyLiver } = await import("./aitherhubWebhook");
    (getLiverByEmail as any).mockResolvedValue(null);

    const { req, res } = createMockReqRes({
      secret: WEBHOOK_SECRET,
      email: "nonexistent@example.com",
    });

    await handleVerifyLiver(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ found: false });
  });

  it("should return found: true with liver name and id for existing liver", async () => {
    const { handleVerifyLiver } = await import("./aitherhubWebhook");
    (getLiverByEmail as any).mockResolvedValue({
      id: 42,
      name: "テストライバー",
      email: "liver@example.com",
    });

    const { req, res } = createMockReqRes({
      secret: WEBHOOK_SECRET,
      email: "liver@example.com",
    });

    await handleVerifyLiver(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      found: true,
      name: "テストライバー",
      id: 42,
    });
  });

  it("should return empty name when liver.name is empty", async () => {
    const { handleVerifyLiver } = await import("./aitherhubWebhook");
    (getLiverByEmail as any).mockResolvedValue({
      id: 99,
      name: "",
      email: "noname@example.com",
    });

    const { req, res } = createMockReqRes({
      secret: WEBHOOK_SECRET,
      email: "noname@example.com",
    });

    await handleVerifyLiver(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      found: true,
      name: "",
      id: 99,
    });
  });

  it("should handle server errors gracefully", async () => {
    const { handleVerifyLiver } = await import("./aitherhubWebhook");
    (getLiverByEmail as any).mockRejectedValue(new Error("DB connection failed"));

    const { req, res } = createMockReqRes({
      secret: WEBHOOK_SECRET,
      email: "error@example.com",
    });

    await handleVerifyLiver(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
