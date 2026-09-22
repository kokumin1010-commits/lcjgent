import { afterEach, describe, expect, it, vi } from "vitest";
import { getLineMessageQuotaStatus } from "./line";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LINE message quota status", () => {
  it("returns remaining-plan inputs for a limited account", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: "limited", value: 200 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ totalUsage: 18 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLineMessageQuotaStatus()).resolves.toEqual({
      type: "limited",
      value: 200,
      totalUsage: 18,
    });
  });

  it("fails closed when LINE cannot confirm quota", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    await expect(getLineMessageQuotaStatus()).rejects.toThrow("LINE_MESSAGE_QUOTA_LOOKUP_FAILED");
  });
});
