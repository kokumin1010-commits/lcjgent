import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getLineUserById = vi.fn();
const getLineUserByLineId = vi.fn();

vi.mock("./db", () => ({
  getLineUserById,
  getLineUserByLineId,
}));

describe("signed LCJ member sessions", () => {
  beforeEach(() => {
    process.env.JWT_SECRET =
      "test-member-session-secret-with-at-least-32-chars";
    getLineUserById.mockReset();
    getLineUserByLineId.mockReset();
  });

  it("accepts a signed member JWT from the HttpOnly cookie", async () => {
    getLineUserById.mockResolvedValue({ id: 42, displayName: "Member" });
    const { createLineMemberSessionToken } = await import(
      "./lineMemberSession"
    );
    const { requireLineMember } = await import("./lineMemberAuth");
    const token = await createLineMemberSessionToken({
      userId: 42,
      expiresAt: Date.now() + 60_000,
    });

    const result = await requireLineMember({
      req: { headers: { cookie: `line_session=${encodeURIComponent(token)}` } },
    });

    expect(result.lineUser?.id).toBe(42);
    expect(getLineUserById).toHaveBeenCalledWith(42);
  });

  it("rejects a forged legacy JSON cookie even when it names a real member", async () => {
    getLineUserById.mockResolvedValue({ id: 42, displayName: "Member" });
    const { requireLineMember } = await import("./lineMemberAuth");
    const forged = encodeURIComponent(
      JSON.stringify({ userId: 42, expiresAt: Date.now() + 60_000 })
    );

    await expect(
      requireLineMember({
        req: { headers: { cookie: `line_session=${forged}` } },
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getLineUserById).not.toHaveBeenCalled();
  });

  it("rejects a valid bearer fallback and requires the HttpOnly cookie by default", async () => {
    getLineUserById.mockResolvedValue({ id: 42, displayName: "Member" });
    const { createLineMemberSessionToken } = await import(
      "./lineMemberSession"
    );
    const { requireLineMember } = await import("./lineMemberAuth");
    const token = await createLineMemberSessionToken({
      userId: 42,
      expiresAt: Date.now() + 60_000,
    });

    await expect(
      requireLineMember({
        req: { headers: { authorization: `Bearer ${token}` } },
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getLineUserById).not.toHaveBeenCalled();
  });

  it("refuses to issue a member session whose lifetime exceeds 30 days", async () => {
    const { createLineMemberSessionToken, LINE_MEMBER_SESSION_TTL_MS } = await import(
      "./lineMemberSession"
    );

    await expect(
      createLineMemberSessionToken({
        userId: 42,
        expiresAt: Date.now() + LINE_MEMBER_SESSION_TTL_MS + 5_000,
      })
    ).rejects.toThrow("cannot exceed 30 days");
  });

  it("rejects an externally signed member token whose declared lifetime exceeds 30 days", async () => {
    const { SignJWT } = await import("jose");
    const { verifyLineMemberSessionToken } = await import("./lineMemberSession");
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ scope: "lcj_member", userId: 42 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + 31 * 24 * 60 * 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

    await expect(verifyLineMemberSessionToken(token)).resolves.toBeNull();
  });

  it("rejects an otherwise valid cookie when it is older than the sensitive-operation limit", async () => {
    getLineUserById.mockResolvedValue({ id: 42, displayName: "Member" });
    const { SignJWT } = await import("jose");
    const { requireLineMember } = await import("./lineMemberAuth");
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ scope: "lcj_member", userId: 42 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(nowSeconds - 40 * 24 * 60 * 60)
      .setExpirationTime(nowSeconds + 60 * 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

    await expect(
      requireLineMember(
        { req: { headers: { cookie: `line_session=${encodeURIComponent(token)}` } } },
        { cookieOnly: true, maxSessionAgeMs: 30 * 24 * 60 * 60 * 1000 }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getLineUserById).not.toHaveBeenCalled();
  });

  it("writes signed tokens rather than raw session JSON to every member cookie", () => {
    const source = readFileSync(resolve("server/routers.ts"), "utf8");
    expect(source).not.toContain(
      'ctx.res.cookie("line_session", JSON.stringify(sessionData)'
    );
    expect(
      source.match(/ctx\.res\.cookie\("line_session", sessionToken/g)
    ).toHaveLength(4);
  });
});
