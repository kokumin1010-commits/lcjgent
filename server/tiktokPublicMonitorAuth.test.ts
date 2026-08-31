import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import type { Request } from "express";
import { COOKIE_NAME } from "../shared/const";

vi.mock("./db", () => ({ getUserById: vi.fn() }));

import * as db from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const original = {
  cookieSecret: ENV.cookieSecret,
  appId: ENV.appId,
  oAuthServerUrl: ENV.oAuthServerUrl,
};

async function token(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(ENV.cookieSecret));
}

function requestWithCookie(value: string) {
  return { headers: { cookie: `${COOKIE_NAME}=${value}` } } as Request;
}

describe("TikTok monitor heartbeat authentication", () => {
  beforeEach(() => {
    ENV.cookieSecret = "tiktok-monitor-auth-test-secret";
    ENV.appId = "test-project";
    ENV.oAuthServerUrl = "";
    vi.mocked(db.getUserById).mockReset();
  });

  afterEach(() => {
    ENV.cookieSecret = original.cookieSecret;
    ENV.appId = original.appId;
    ENV.oAuthServerUrl = original.oAuthServerUrl;
  });

  it("preserves the existing local userId session flow", async () => {
    const localUser = {
      id: 7,
      email: "admin@example.com",
      password: "hashed",
      name: "Admin",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    vi.mocked(db.getUserById).mockResolvedValue(localUser);
    const result = await sdk.authenticateRequest(
      requestWithCookie(await token({ userId: 7 }))
    );
    expect(result).toEqual(localUser);
    expect(result.isCron).toBeUndefined();
    expect(db.getUserById).toHaveBeenCalledWith(7);
  });

  it("accepts a signed cron identity only when taskUid is present", async () => {
    const result = await sdk.authenticateRequest(
      requestWithCookie(
        await token({ openId: "cron_public_tiktok", taskUid: "task_123" })
      )
    );
    expect(result).toMatchObject({
      id: -1,
      isCron: true,
      taskUid: "task_123",
      role: "user",
    });
    expect(db.getUserById).not.toHaveBeenCalled();
  });

  it("rejects cron-like sessions without a resolvable taskUid", async () => {
    await expect(
      sdk.authenticateRequest(
        requestWithCookie(await token({ openId: "cron_public_tiktok" }))
      )
    ).rejects.toThrow("Cron verification service is not configured");
  });

  it("rejects ordinary openId tokens and invalid signatures", async () => {
    await expect(
      sdk.authenticateRequest(
        requestWithCookie(await token({ openId: "ordinary-user" }))
      )
    ).rejects.toThrow("Invalid session cookie");
    const forged = await new SignJWT({
      openId: "cron_public_tiktok",
      taskUid: "task_123",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode("wrong-secret"));
    await expect(
      sdk.authenticateRequest(requestWithCookie(forged))
    ).rejects.toThrow("Invalid session cookie");
  });
});
