import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const financePage = readFileSync(new URL("../client/src/pages/FinanceManagement.tsx", import.meta.url), "utf8");
const mainClient = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
const sessionModule = readFileSync(new URL("../client/src/lib/financeAccessSession.ts", import.meta.url), "utf8");
const accessRouter = readFileSync(new URL("./financeAccessRouter.ts", import.meta.url), "utf8");

describe("finance page-scoped reauthentication", () => {
  it("keeps the finance page session in memory instead of persistent browser storage", () => {
    expect(sessionModule).toContain("let activeFinanceSessionId");
    expect(sessionModule).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(financePage).toContain("beginFinanceAccessSession()");
    expect(financePage).toContain("clearFinanceAccessSession()");
  });

  it("sends the current finance page session on every tRPC request", () => {
    expect(mainClient).toContain('headers.set("X-LCJ-Finance-Session", financeAccessSession)');
    expect(financePage).toContain("unlockMutation.mutate({ password, sessionId: financeSessionId })");
  });

  it("requires a validated session identifier at the unlock endpoint", () => {
    expect(accessRouter).toContain("sessionId: z.string().min(16).max(128)");
    expect(accessRouter).toContain("verifyAndUnlockFinance(ctx, input.password, input.sessionId)");
  });

  it("explains the device-specific state and always exposes an explicit relock action", () => {
    expect(financePage).toContain("每次打开财务页面都需要验证");
    expect(financePage).toContain("本设备已完成财务密码验证");
    expect(financePage).toContain("离开后再次进入需要重新输入");
    expect(financePage).toContain("重新锁定");
  });
});
