import { describe, expect, it } from "vitest";
import {
  resolveMatrixAccountIdentity,
  safeMatrixMonitorWarning,
  shouldQueueMatrixTikTokSync,
} from "./svmTikTokAutoSync";

describe("short-video matrix TikTok auto sync", () => {
  it("uses a valid TikTok profile URL as the authoritative username", () => {
    expect(
      resolveMatrixAccountIdentity({
        accountName: "wrong-name",
        platform: "tiktok",
        profileUrl: "https://www.tiktok.com/@LCJ.mall?lang=ja",
        status: "active",
      })
    ).toEqual({
      accountName: "LCJ.mall",
      platform: "tiktok",
      profileUrl: "https://www.tiktok.com/@LCJ.mall",
      status: "active",
      monitoringEligible: true,
    });
  });

  it("rejects non-TikTok, video and malformed URLs", () => {
    for (const profileUrl of [
      "https://example.com/@seller",
      "https://www.tiktok.com/@seller/video/123",
      "javascript:alert(1)",
    ]) {
      expect(() =>
        resolveMatrixAccountIdentity({
          accountName: "seller",
          platform: "tiktok",
          profileUrl,
          status: "active",
        })
      ).toThrow("TikTok");
    }
  });

  it("preserves legacy name-only accounts without starting external monitoring", () => {
    expect(
      resolveMatrixAccountIdentity({
        accountName: "@legacy_seller",
        platform: "tiktok",
        profileUrl: "",
        status: "active",
      })
    ).toMatchObject({
      accountName: "legacy_seller",
      profileUrl: null,
      monitoringEligible: false,
    });
  });

  it("queues new, changed and resumed profile URLs but not unrelated edits", () => {
    const active = resolveMatrixAccountIdentity({
      accountName: "seller",
      platform: "tiktok",
      profileUrl: "https://www.tiktok.com/@seller",
      status: "active",
    });
    expect(shouldQueueMatrixTikTokSync(null, active)).toBe(true);
    expect(
      shouldQueueMatrixTikTokSync(
        {
          accountName: "seller",
          platform: "tiktok",
          profileUrl: "https://www.tiktok.com/@seller",
          status: "active",
        },
        active
      )
    ).toBe(false);
    expect(
      shouldQueueMatrixTikTokSync(
        {
          accountName: "oldSeller",
          platform: "tiktok",
          profileUrl: "https://www.tiktok.com/@oldSeller",
          status: "active",
        },
        active
      )
    ).toBe(true);
    expect(
      shouldQueueMatrixTikTokSync(
        {
          accountName: "seller",
          platform: "tiktok",
          profileUrl: "https://www.tiktok.com/@seller",
          status: "paused",
        },
        active
      )
    ).toBe(true);
  });

  it("never queues paused or archived accounts", () => {
    for (const status of ["paused", "archived"] as const) {
      const resolved = resolveMatrixAccountIdentity({
        accountName: "seller",
        platform: "tiktok",
        profileUrl: "https://www.tiktok.com/@seller",
        status,
      });
      expect(resolved.monitoringEligible).toBe(false);
      expect(shouldQueueMatrixTikTokSync(null, resolved)).toBe(false);
    }
  });

  it("does not expose provider or internal error details to users", () => {
    const warning = safeMatrixMonitorWarning(
      new Error("TikTok provider HTTP 500 mysql://secret@host/database")
    );
    expect(warning).toContain("账号已保存");
    expect(warning).not.toContain("mysql");
    expect(warning).not.toContain("secret");
    expect(warning).not.toContain("HTTP 500");
  });
});
