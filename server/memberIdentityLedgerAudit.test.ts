import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(async () => ({
    success: true,
    emailHash: "a".repeat(64),
    lookupFound: true,
    walletFound: true,
    centralLedgerAvailable: true,
    unifiedTotal: 6255,
    storeCount: 1,
    stores: ["beautypass"],
    historyComplete: true,
    historyRowsFetched: 2,
    uniqueTransactionCount: 2,
    duplicateRowsRemoved: 0,
  })),
}));

vi.mock("./bw-api", () => ({
  bwAuditCentralLedgerByEmail: mocks.audit,
}));

import { memberIdentityRouter } from "./memberIdentityRouter";

function context(user: null | { id: number; role: "user" | "admin" }) {
  return {
    user: user
      ? {
          id: user.id,
          openId: `ledger-user-${user.id}`,
          email: `ledger-${user.id}@example.invalid`,
          name: "Ledger Auditor",
          loginMethod: "test",
          role: user.role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { headers: {} },
    res: {},
  } as any;
}

describe("member identity Beauty Wallet ledger audit authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated callers before auditing", async () => {
    const caller = memberIdentityRouter.createCaller(context(null));
    await expect(
      caller.auditBeautyWalletLedger({ email: "member@example.com" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers before auditing", async () => {
    const caller = memberIdentityRouter.createCaller(
      context({ id: 2, role: "user" })
    );
    await expect(
      caller.auditBeautyWalletLedger({ email: "member@example.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("allows admins and forwards only the validated email", async () => {
    const caller = memberIdentityRouter.createCaller(
      context({ id: 1, role: "admin" })
    );
    const result = await caller.auditBeautyWalletLedger({
      email: "member@example.com",
    });
    expect(result.centralLedgerAvailable).toBe(true);
    expect(mocks.audit).toHaveBeenCalledWith("member@example.com");
  });
});
