import { afterEach, describe, expect, it, vi } from "vitest";
import { getRequestCookie } from "./requestCookies";
import { lineLoginRouter } from "./routers";

function createContext(cookieHeader?: string) {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
  const headers = new Map<string, string>();
  const req = {
    protocol: "https",
    hostname: "lcjmall.com",
    secure: true,
    headers: {
      cookie: cookieHeader,
      "x-forwarded-proto": "https",
    },
  };
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
    clearCookie: (name: string, options: Record<string, unknown>) => cleared.push({ name, options }),
    setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
  };
  return { ctx: { req, res, user: null } as any, cookies, cleared, headers };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LCJ member request cookie parsing", () => {
  it("reads an Express-encoded LINE member session from the raw Cookie header", () => {
    const session = JSON.stringify({ lineUserId: "Uoriginal", expiresAt: Date.now() + 60_000 });
    const req = { headers: { cookie: `other=1; line_session=${encodeURIComponent(session)}` } };
    expect(getRequestCookie(req, "line_session")).toBe(session);
  });

  it("keeps compatibility with a pre-parsed cookie and fails closed on missing input", () => {
    expect(getRequestCookie({ headers: {}, cookies: { line_session: "pre-parsed" } }, "line_session")).toBe("pre-parsed");
    expect(getRequestCookie({ headers: {} }, "line_session")).toBeUndefined();
  });
});

describe("LINE login state regression", () => {
  it("creates a fresh non-cacheable state cookie bound to the returned login URL", async () => {
    const { ctx, cookies, headers } = createContext();
    const result = await lineLoginRouter.createCaller(ctx).getLoginUrl();
    const stateCookie = cookies.find(cookie => cookie.name === "line_login_state");

    expect(stateCookie?.value).toHaveLength(32);
    expect(stateCookie?.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 600_000 });
    expect(new URL(result.loginUrl).searchParams.get("state")).toBe(stateCookie?.value);
    expect(headers.get("cache-control")).toBe("no-store, private, max-age=0");
    expect(headers.get("pragma")).toBe("no-cache");
  });

  it("accepts matching state from the raw Cookie header before exchanging the code", async () => {
    const state = "raw-cookie-state-1234567890123456";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("invalid code", { status: 400 }));
    const { ctx, cleared } = createContext(`line_login_state=${state}`);

    await expect(lineLoginRouter.createCaller(ctx).callback({ code: "invalid-readonly-code", state })).rejects.toMatchObject({
      message: "LINE認証に失敗しました",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cleared.some(cookie => cookie.name === "line_login_state")).toBe(true);
  });

  it("rejects a mismatched state before any external token exchange", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { ctx } = createContext("line_login_state=expected-state");

    await expect(lineLoginRouter.createCaller(ctx).callback({ code: "unused", state: "attacker-state" })).rejects.toMatchObject({
      message: "LINE認証の有効期限が切れました。もう一度ログインしてください",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
