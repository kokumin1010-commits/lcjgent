import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  verifyLineAccessToken,
  verifyLineIdToken,
} from "./lineIdTokenVerifier";

const CHANNEL_ID = "1234567890";
const TOKEN = "header.payload.signature";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyLineIdToken", () => {
  it("routes the LIFF fallback through verification instead of decoding claims locally", () => {
    const router = readFileSync(resolve("server/routers.ts"), "utf8");
    const liffCallback = router.slice(
      router.indexOf("liffCallback: publicProcedure"),
      router.indexOf("// Validate referral code")
    );

    expect(liffCallback).toContain("verifyLineAccessToken(");
    expect(liffCallback).toContain("verifyLineIdToken(");
    expect(liffCallback).toContain("LINE_LOGIN_CHANNEL_ID");
    expect(liffCallback).not.toContain("Buffer.from(parts[1]");
    expect(liffCallback).not.toContain("ID token payload:");
  });

  it("fails closed when the LINE Login channel ID is unavailable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(verifyLineIdToken(TOKEN, "")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts an unexpired access token only for the expected channel and profile scope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        client_id: CHANNEL_ID,
        expires_in: 300,
        scope: "openid profile",
      })
    );

    await expect(verifyLineAccessToken(TOKEN, CHANNEL_ID)).resolves.toBe(true);
  });

  it.each([
    {
      client_id: "different-channel",
      expires_in: 300,
      scope: "openid profile",
    },
    {
      client_id: CHANNEL_ID,
      expires_in: 0,
      scope: "openid profile",
    },
    {
      client_id: CHANNEL_ID,
      expires_in: 300,
      scope: "openid",
    },
  ])("rejects an access token outside the expected channel contract", async payload => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(payload));

    await expect(verifyLineAccessToken(TOKEN, CHANNEL_ID)).resolves.toBe(false);
  });

  it("rejects a forged token when the LINE verification endpoint rejects it", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 400 }));

    await expect(verifyLineIdToken(TOKEN, CHANNEL_ID)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options?.method).toBe("POST");
    expect(options?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = new URLSearchParams(String(options?.body));
    expect(body.get("id_token")).toBe(TOKEN);
    expect(body.get("client_id")).toBe(CHANNEL_ID);
  });

  it("accepts only a verified, unexpired token for the expected channel", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        iss: "https://access.line.me",
        sub: "U1234567890abcdef1234567890abcdef",
        aud: CHANNEL_ID,
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        name: "Verified Member",
        picture: "https://profile.line-scdn.net/example",
      })
    );

    await expect(verifyLineIdToken(TOKEN, CHANNEL_ID)).resolves.toEqual({
      userId: "U1234567890abcdef1234567890abcdef",
      displayName: "Verified Member",
      pictureUrl: "https://profile.line-scdn.net/example",
    });
  });

  it.each([
    {
      label: "issuer",
      payload: {
        iss: "https://attacker.invalid",
        sub: "U1234567890abcdef1234567890abcdef",
        aud: CHANNEL_ID,
        exp: Math.floor(Date.now() / 1000) + 300,
      },
    },
    {
      label: "audience",
      payload: {
        iss: "https://access.line.me",
        sub: "U1234567890abcdef1234567890abcdef",
        aud: "different-channel",
        exp: Math.floor(Date.now() / 1000) + 300,
      },
    },
    {
      label: "expiration",
      payload: {
        iss: "https://access.line.me",
        sub: "U1234567890abcdef1234567890abcdef",
        aud: CHANNEL_ID,
        exp: Math.floor(Date.now() / 1000) - 1,
      },
    },
  ])("rejects a verified response with an invalid $label", async ({ payload }) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(payload));

    await expect(verifyLineIdToken(TOKEN, CHANNEL_ID)).resolves.toBeNull();
  });
});
