import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginFinanceAccessSession,
  clearFinanceAccessSession,
  getFinanceAccessSession,
  persistFinanceAccessSession,
  resetFinanceAccessSessionForTests,
} from "../client/src/lib/financeAccessSession";

const financePage = readFileSync(new URL("../client/src/pages/FinanceManagement.tsx", import.meta.url), "utf8");
const mainClient = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
const authHook = readFileSync(new URL("../client/src/_core/hooks/useAuth.ts", import.meta.url), "utf8");
const sessionModule = readFileSync(new URL("../client/src/lib/financeAccessSession.ts", import.meta.url), "utf8");
const accessRouter = readFileSync(new URL("./financeAccessRouter.ts", import.meta.url), "utf8");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();

describe("finance 8-hour browser reauthentication", () => {
  beforeEach(() => {
    storage.clear();
    resetFinanceAccessSessionForTests();
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    clearFinanceAccessSession();
    vi.unstubAllGlobals();
  });

  it("persists the same finance session across refresh-like memory resets", () => {
    const first = beginFinanceAccessSession();
    persistFinanceAccessSession(Date.now() + 8 * 60 * 60 * 1000);

    resetFinanceAccessSessionForTests();

    expect(getFinanceAccessSession()).toBe(first);
    expect(beginFinanceAccessSession()).toBe(first);
  });

  it("removes an expired browser session instead of reusing it", () => {
    storage.setItem("lcj_finance_access_session_v2", JSON.stringify({
      id: "finance-expired-session-0001",
      expiresAt: Date.now() - 1,
    }));
    resetFinanceAccessSessionForTests();

    expect(getFinanceAccessSession()).toBe("");
    expect(storage.getItem("lcj_finance_access_session_v2")).toBeNull();
  });

  it("clears the browser session on explicit lock", () => {
    beginFinanceAccessSession();
    expect(getFinanceAccessSession()).not.toBe("");

    clearFinanceAccessSession();

    expect(getFinanceAccessSession()).toBe("");
  });

  it("does not clear the session merely because the finance component unmounts", () => {
    expect(sessionModule).toContain("window.localStorage");
    expect(financePage).not.toContain("useEffect(() => () => clearFinanceAccessSession()");
    expect(financePage).toContain("persistFinanceAccessSession(result.expiresAt)");
    expect(financePage).toContain("clearFinanceAccessSession();");
  });

  it("sends the persisted finance session on every tRPC request", () => {
    expect(mainClient).toContain('headers.set("X-LCJ-Finance-Session", financeAccessSession)');
    expect(financePage).toContain("unlockMutation.mutate({ password, sessionId: financeSessionId })");
  });

  it("clears the finance browser session when the main account logs out", () => {
    expect(authHook).toContain('import { clearFinanceAccessSession } from "@/lib/financeAccessSession"');
    expect(authHook).toContain("clearFinanceAccessSession();");
  });

  it("requires a validated session identifier at the unlock endpoint", () => {
    expect(accessRouter).toContain("sessionId: z.string().min(16).max(128)");
    expect(accessRouter).toContain("verifyAndUnlockFinance(ctx, input.password, input.sessionId)");
  });

  it("explains the 8-hour same-browser behavior and exposes explicit relock", () => {
    expect(financePage).toContain("同一登录、同一浏览器验证后8小时内");
    expect(financePage).toContain("刷新或重新打开财务页面无需重复输入");
    expect(financePage).toContain("本设备已完成财务密码验证");
    expect(financePage).toContain("刷新、切换标签或重新进入无需重复输入");
    expect(financePage).toContain("重新锁定");
  });
});
