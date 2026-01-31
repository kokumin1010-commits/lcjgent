import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock ENV
vi.mock("./_core/env", () => ({
  ENV: {
    prolineWebhookUrl: "https://autosns.jp/webhook/CDsj0LpYSM",
  },
}));

describe("Proline Forward", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should forward webhook to Proline when URL is configured", async () => {
    // Import after mocking
    const { forwardToProline } = await import("./line");
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const rawBody = JSON.stringify({
      destination: "test",
      events: [{ type: "message", source: { type: "user", userId: "U123" } }],
    });
    const signature = "test-signature";

    await forwardToProline(rawBody, signature);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://autosns.jp/webhook/CDsj0LpYSM",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Line-Signature": signature,
        },
        body: rawBody,
      }
    );
  });

  it("should not throw error when forward fails", async () => {
    const { forwardToProline } = await import("./line");
    
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const rawBody = JSON.stringify({ events: [] });
    const signature = "test-signature";

    // Should not throw
    await expect(forwardToProline(rawBody, signature)).resolves.toBeUndefined();
  });

  it("should handle non-ok response gracefully", async () => {
    const { forwardToProline } = await import("./line");
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const rawBody = JSON.stringify({ events: [] });
    const signature = "test-signature";

    // Should not throw
    await expect(forwardToProline(rawBody, signature)).resolves.toBeUndefined();
  });
});

describe("Proline Forward - URL not configured", () => {
  it("should skip forwarding when PROLINE_WEBHOOK_URL is not set", async () => {
    // Reset modules to test with empty URL
    vi.resetModules();
    vi.doMock("./_core/env", () => ({
      ENV: {
        prolineWebhookUrl: "",
      },
    }));

    const { forwardToProline } = await import("./line");
    
    const rawBody = JSON.stringify({ events: [] });
    const signature = "test-signature";

    await forwardToProline(rawBody, signature);

    // fetch should not be called when URL is not configured
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
