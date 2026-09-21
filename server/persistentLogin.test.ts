import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  LINE_MEMBER_SESSION_TTL_MS,
  createLineMemberSessionToken,
  verifyLineMemberSessionToken,
} from "./lineMemberSession";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("bounded LCJ member sessions", () => {
  beforeEach(() => {
    process.env.JWT_SECRET =
      "test-persistent-session-secret-with-at-least-32-characters";
  });

  it("uses a 30-day maximum session lifetime", () => {
    expect(LINE_MEMBER_SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("generates and verifies a signed member JWT", async () => {
    const sessionToken = await createLineMemberSessionToken({
      lineUserId: "U1234567890",
      userId: 1,
      expiresAt: Date.now() + LINE_MEMBER_SESSION_TTL_MS,
    });

    expect(sessionToken.split(".")).toHaveLength(3);
    const verified = await verifyLineMemberSessionToken(sessionToken);
    expect(verified?.lineUserId).toBe("U1234567890");
    expect(verified?.userId).toBe(1);
    expect(verified?.issuedAt).toBeTypeOf("number");
  });

  it("rejects unsigned JSON claims", async () => {
    const forged = Buffer.from(
      JSON.stringify({
        userId: 1,
        expiresAt: Date.now() + LINE_MEMBER_SESSION_TTL_MS,
      })
    ).toString("base64");

    await expect(verifyLineMemberSessionToken(forged)).resolves.toBeNull();
  });

  it("never stores or transports member sessions through browser JavaScript", () => {
    const sources = [
      read("client/src/main.tsx"),
      read("client/src/pages/BeautyWallet.tsx"),
      read("client/src/pages/LineMypage.tsx"),
      read("client/src/pages/ReceiptUpload.tsx"),
      read("client/src/pages/PointRequest.tsx"),
      read("client/src/pages/LineLogin.tsx"),
      read("client/src/pages/LineLoginCallback.tsx"),
    ].join("\n");

    expect(sources).not.toContain("localStorage.setItem('lcj_session_token'");
    expect(sources).not.toContain('localStorage.setItem("lcj_session_token"');
    expect(sources).not.toContain("receipt-upload?token=");
    expect(sources).not.toContain("data.sessionToken");
    expect(sources).not.toContain("user?.sessionToken");

    const router = read("server/routers.ts");
    const memberLoginBlock = router.slice(
      router.indexOf("lineLogin: router({"),
      router.indexOf("pointRequest: router({")
    );
    expect(memberLoginBlock).not.toMatch(/return\s*\{[^}]*sessionToken/s);
  });
});
