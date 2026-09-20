import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: { lineChannelAccessToken: "test-token" },
}));

import { sendLinePushMessage } from "./_core/lineMessaging";
import { pushMessage } from "./line";
import { createLineRetryKey } from "./lineRetryKey";

describe("LINE retry key", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is a stable UUID for the same webhook purpose and differs by purpose", () => {
    const first = createLineRetryKey("line-webhook:event-1:liver-link-completed");
    const repeated = createLineRetryKey("line-webhook:event-1:liver-link-completed");
    const other = createLineRetryKey("line-webhook:event-1:liver-link-invalid");
    expect(first).toBe(repeated);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(other).not.toBe(first);
  });

  it("sends the retry key through X-Line-Retry-Key", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const retryKey = createLineRetryKey("line-webhook:event-2:follow-unlinked");

    await expect(sendLinePushMessage("U-test", [{ type: "text", text: "hello" }], retryKey))
      .resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect((options.headers as Record<string, string>)["X-Line-Retry-Key"]).toBe(retryKey);
    expect(options.signal).toBeDefined();
  });

  it("treats LINE's accepted duplicate response as success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {
      status: 409,
      headers: { "x-line-accepted-request-id": "accepted-request" },
    })));
    const retryKey = createLineRetryKey("line-webhook:event-3:mall-link-completed");
    await expect(sendLinePushMessage("U-test", [{ type: "text", text: "hello" }], retryKey))
      .resolves.toEqual({ success: true });
  });

  it("treats an accepted duplicate as delivered in the AI push transport", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {
      status: 409,
      headers: { "x-line-accepted-request-id": "accepted-request" },
    })));
    const retryKey = createLineRetryKey("line-ai-manager:reply:event-5");
    await expect(pushMessage("U-test", [{ type: "text", text: "hello" }], retryKey)).resolves.toBe(true);
  });

  it("propagates a keyed push failure so the webhook can be redelivered safely", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"temporary"}', { status: 503 })));
    const retryKey = createLineRetryKey("line-webhook:event-4:liver-link-completed");
    await expect(sendLinePushMessage("U-test", [{ type: "text", text: "hello" }], retryKey))
      .rejects.toThrow("LINE API error: 503");
  });
});
