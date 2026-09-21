import { readFileSync } from "node:fs";
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
  merge: vi.fn(async () => ({ success: true })),
  assertAllowed: vi.fn(async () => undefined),
}));

vi.mock("./bw-api", () => ({
  bwAuditCentralLedgerByEmail: mocks.audit,
}));

vi.mock("./memberAccountMergeService", () => ({
  mergeEmailAndLineMemberAccounts: mocks.merge,
}));

vi.mock("./memberRestrictionService", () => ({
  assertMemberActionAllowed: mocks.assertAllowed,
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

  it("exposes an explicit read-only central ledger audit in member details", () => {
    const page = readFileSync(
      new URL("../client/src/pages/MemberDetail.tsx", import.meta.url),
      "utf8"
    );
    expect(page).toContain(
      "trpc.memberIdentity.auditBeautyWalletLedger.useMutation"
    );
    expect(page).toContain("Beauty Wallet 統一主台帳");
    expect(page).toContain("主台帳を照合");
    expect(page).toContain(
      "ウォレット作成・残高同期・ポイント変更は行いません"
    );
    expect(page).toContain("統一残高（唯一の現在残高）");
  });
});

describe("member account merge central-ledger gate", () => {
  const mergeInput = {
    targetEmailMemberId: 101,
    sourceLineMemberId: 202,
    expectedEmail: "member@example.com",
    expectedLineUserId: `U${"a".repeat(32)}`,
    expectedTargetBalance: 2067,
    expectedSourceBalance: 4188,
    reason: "verified identity merge test",
  };

  beforeEach(() => vi.clearAllMocks());

  it("stops before local merge when the Beauty Wallet identity is missing", async () => {
    mocks.audit.mockResolvedValueOnce({
      success: true,
      emailHash: "a".repeat(64),
      lookupFound: false,
      walletFound: false,
      centralLedgerAvailable: false,
      unifiedTotal: null,
      storeCount: 0,
      stores: [],
      historyComplete: false,
      historyRowsFetched: 0,
      uniqueTransactionCount: 0,
      duplicateRowsRemoved: 0,
      failureCode: "CUSTOMER_NOT_FOUND",
    });
    const caller = memberIdentityRouter.createCaller(
      context({ id: 1, role: "admin" })
    );
    await expect(caller.mergeEmailAndLineAccounts(mergeInput)).rejects.toMatchObject(
      { code: "PRECONDITION_FAILED" }
    );
    expect(mocks.merge).not.toHaveBeenCalled();
  });

  it("stops before local merge when the authoritative balance differs", async () => {
    mocks.audit.mockResolvedValueOnce({
      success: true,
      emailHash: "a".repeat(64),
      lookupFound: true,
      walletFound: true,
      centralLedgerAvailable: true,
      unifiedTotal: 4188,
      storeCount: 1,
      stores: ["beautypass"],
      historyComplete: true,
      historyRowsFetched: 2,
      uniqueTransactionCount: 2,
      duplicateRowsRemoved: 0,
    });
    const caller = memberIdentityRouter.createCaller(
      context({ id: 1, role: "admin" })
    );
    await expect(caller.mergeEmailAndLineAccounts(mergeInput)).rejects.toMatchObject(
      { code: "PRECONDITION_FAILED" }
    );
    expect(mocks.merge).not.toHaveBeenCalled();
  });

  it("allows the existing audited merge only when the unified total matches", async () => {
    const caller = memberIdentityRouter.createCaller(
      context({ id: 1, role: "admin" })
    );
    await expect(caller.mergeEmailAndLineAccounts(mergeInput)).resolves.toEqual({
      success: true,
    });
    expect(mocks.merge).toHaveBeenCalledOnce();
  });
});
