import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBrandDayPoolMock } = vi.hoisted(() => ({
  getBrandDayPoolMock: vi.fn(),
}));

vi.mock("./brandDayPool", () => ({
  getBrandDayPool: getBrandDayPoolMock,
}));

import { brandDayCreatorRouter, brandDayPublicRouter } from "./brandDayPublicRouter";

const event = {
  id: 7,
  brand_id: null,
  slug: "kozuday",
  title: "Dr.Kozu BRAND DAY",
  short_name: "Dr.Kozu",
  timezone: "Asia/Tokyo",
  event_start_at: new Date("2026-10-04T15:00:00.000Z"),
  event_end_at: new Date("2026-10-12T15:00:00.000Z"),
  registration_open_at: null,
  registration_close_at: null,
  minimum_stream_minutes: 60,
  status: "active",
  logo_url: null,
  theme_json: null,
  rules_json: null,
};

const entryInput = {
  slug: "kozuday",
  registrationName: "Auto Login Test",
  tiktokId: "@auto-login-test",
  tiktokName: "Auto Login Test",
  lineId: "line-auto-login-test",
  phone: "0000000000",
  email: "auto-login@example.test",
  password: "password123",
  passwordConfirmation: "password123",
  website: "",
};

function responseSpies() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

describe("Brand Day creator auto-login runtime behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("commits entry, account and hashed session before setting the secure creator cookie", async () => {
    const connection = {
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO brand_day_entries")) return [{ insertId: 101 }, []];
        if (sql.includes("INSERT INTO brand_day_creator_accounts")) return [{ insertId: 202 }, []];
        return [{ affectedRows: 1 }, []];
      }),
    };
    const pool = {
      query: vi.fn(async () => [[event], []]),
      getConnection: vi.fn(async () => connection),
    };
    getBrandDayPoolMock.mockResolvedValue(pool);
    const res = responseSpies();
    const caller = brandDayPublicRouter.createCaller({
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res,
    } as any);

    const result = await caller.enter(entryInput);

    expect(result).toEqual({ success: true, entryId: 101, accountId: 202, authenticated: true });
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();

    const sessionCall = connection.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO brand_day_creator_sessions"));
    expect(sessionCall).toBeDefined();
    expect(sessionCall?.[1]?.[0]).toBe(7);
    expect(sessionCall?.[1]?.[1]).toBe(202);
    expect(sessionCall?.[1]?.[2]).toMatch(/^[a-f0-9]{64}$/);
    expect(res.cookie).toHaveBeenCalledOnce();
    const [cookieName, rawToken, options] = res.cookie.mock.calls[0];
    expect(cookieName).toBe("lcj_brand_day_creator_session");
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(rawToken).not.toBe(sessionCall?.[1]?.[2]);
    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 12 * 60 * 60 * 1000,
    });
  });

  it("rolls back the complete registration and never sets a cookie when session creation fails", async () => {
    const connection = {
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO brand_day_entries")) return [{ insertId: 101 }, []];
        if (sql.includes("INSERT INTO brand_day_creator_accounts")) return [{ insertId: 202 }, []];
        if (sql.includes("INSERT INTO brand_day_creator_sessions")) throw new Error("session insert failed");
        return [{ affectedRows: 1 }, []];
      }),
    };
    getBrandDayPoolMock.mockResolvedValue({
      query: vi.fn(async () => [[event], []]),
      getConnection: vi.fn(async () => connection),
    });
    const res = responseSpies();
    const caller = brandDayPublicRouter.createCaller({
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res,
    } as any);

    await expect(caller.enter(entryInput)).rejects.toThrow("session insert failed");
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("does not create a cookie when the creator credentials are invalid", async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce([[event], []])
        .mockResolvedValueOnce([[], []]),
      getConnection: vi.fn(),
    };
    getBrandDayPoolMock.mockResolvedValue(pool);
    const res = responseSpies();
    const caller = brandDayCreatorRouter.createCaller({
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res,
    } as any);

    await expect(caller.login({ slug: "kozuday", tiktokId: "@missing", password: "password123" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
