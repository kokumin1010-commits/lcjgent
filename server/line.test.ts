import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

describe("LINE API Configuration", () => {
  it("should have LINE_CHANNEL_SECRET configured", () => {
    expect(ENV.lineChannelSecret).toBeTruthy();
    expect(ENV.lineChannelSecret.length).toBeGreaterThan(10);
  });

  it("should have LINE_CHANNEL_ACCESS_TOKEN configured", () => {
    expect(ENV.lineChannelAccessToken).toBeTruthy();
    expect(ENV.lineChannelAccessToken.length).toBeGreaterThan(50);
  });

  it("should validate LINE API credentials by calling bot info endpoint", async () => {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
      },
    });

    // 200 = success, credentials are valid
    expect(response.status).toBe(200);

    const data = await response.json();
    // Bot should have a userId and displayName
    expect(data.userId).toBeTruthy();
    expect(data.displayName).toBeTruthy();
    
    console.log("LINE Bot Info:", data.displayName);
  }, 15000); // Increase timeout to 15 seconds for network request
});
