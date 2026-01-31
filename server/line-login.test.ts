import { describe, it, expect } from "vitest";

describe("LINE Login Configuration", () => {
  it("should have LINE_LOGIN_CHANNEL_ID set", () => {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    expect(channelId).toBeDefined();
    expect(channelId).not.toBe("");
    // LINE Channel IDs are typically numeric strings
    expect(channelId).toMatch(/^\d+$/);
  });

  it("should have LINE_LOGIN_CHANNEL_SECRET set", () => {
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    expect(channelSecret).toBeDefined();
    expect(channelSecret).not.toBe("");
    // LINE Channel Secrets are typically 32 character hex strings
    expect(channelSecret!.length).toBeGreaterThanOrEqual(20);
  });

  it("should generate valid LINE Login URL", () => {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const appUrl = process.env.APP_URL || "https://lcjagent.manus.space";
    const callbackUrl = `${appUrl}/api/line-login/callback`;
    
    const params = new URLSearchParams({
      response_type: "code",
      client_id: channelId || "",
      redirect_uri: callbackUrl,
      state: "test_state",
      scope: "profile openid",
    });
    
    const loginUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
    
    expect(loginUrl).toContain("access.line.me");
    expect(loginUrl).toContain(`client_id=${channelId}`);
    expect(loginUrl).toContain("response_type=code");
    expect(loginUrl).toContain("scope=profile+openid");
  });
});
