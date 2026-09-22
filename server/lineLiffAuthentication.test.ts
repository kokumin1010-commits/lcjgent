import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID;

function createContext() {
  const cookies: Array<{ name: string; value: string }> = [];
  return {
    cookies,
    ctx: {
      req: {
        protocol: "https",
        hostname: "lcjmall.com",
        secure: true,
        headers: { "x-forwarded-proto": "https" },
      },
      res: {
        cookie: (name: string, value: string) => cookies.push({ name, value }),
        clearCookie: vi.fn(),
        setHeader: vi.fn(),
      },
      user: null,
    } as any,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  if (ORIGINAL_CHANNEL_ID === undefined) {
    delete process.env.LINE_LOGIN_CHANNEL_ID;
  } else {
    process.env.LINE_LOGIN_CHANNEL_ID = ORIGINAL_CHANNEL_ID;
  }
});

describe("LIFF member authentication", () => {
  it("rejects a forged JWT payload without issuing a member cookie", async () => {
    process.env.LINE_LOGIN_CHANNEL_ID = "1234567890";
    vi.resetModules();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 400 }))
      .mockResolvedValueOnce(new Response("{}", { status: 400 }));
    const { lineLoginRouter } = await import("./routers");
    const { ctx, cookies } = createContext();
    const forgedToken = [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
        "base64url"
      ),
      Buffer.from(
        JSON.stringify({
          iss: "https://access.line.me",
          sub: "Uforgedidentity",
          aud: "1234567890",
          exp: Math.floor(Date.now() / 1000) + 300,
        })
      ).toString("base64url"),
      "forged-signature",
    ].join(".");

    await expect(
      lineLoginRouter.createCaller(ctx).liffCallback({
        accessToken: forgedToken,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "LINEプロフィールの取得に失敗しました",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cookies.some(cookie => cookie.name === "line_session")).toBe(false);
  }, 20_000);
});
