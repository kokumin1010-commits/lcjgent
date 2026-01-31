import { describe, it, expect } from "vitest";

describe("LINE Login Callback URL Configuration", () => {
  it("should have APP_URL set to lcjmall.com", () => {
    const appUrl = process.env.APP_URL;
    expect(appUrl).toBeDefined();
    expect(appUrl).toBe("https://lcjmall.com");
  });

  it("should generate correct callback URL", () => {
    const appUrl = process.env.APP_URL;
    const callbackUrl = `${appUrl}/line-callback`;
    expect(callbackUrl).toBe("https://lcjmall.com/line-callback");
  });

  it("should have LINE_LOGIN_CHANNEL_ID set", () => {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    expect(channelId).toBeDefined();
    expect(channelId).not.toBe("");
  });

  it("should have LINE_LOGIN_CHANNEL_SECRET set", () => {
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    expect(channelSecret).toBeDefined();
    expect(channelSecret).not.toBe("");
  });
});
