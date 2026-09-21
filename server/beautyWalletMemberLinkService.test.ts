import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  connectionQuery: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  sendEmail: vi.fn(),
  resolveCustomer: vi.fn(),
  auditLedger: vi.fn(),
}));

vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => ({
      query: mocks.poolQuery,
      getConnection: async () => ({
        query: mocks.connectionQuery,
        beginTransaction: mocks.beginTransaction,
        commit: mocks.commit,
        rollback: mocks.rollback,
        release: mocks.release,
      }),
    }),
  },
}));

vi.mock("./emailService", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("./bw-api", () => ({
  bwResolveCustomerForVerifiedLink: mocks.resolveCustomer,
  bwAuditCentralLedgerByEmail: mocks.auditLedger,
}));

function otpHash(token: string, code: string) {
  return createHmac("sha256", process.env.JWT_SECRET!)
    .update(`${token}:${code}`)
    .digest("hex");
}

describe("Beauty Wallet member link service", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test:test@localhost/test";
    process.env.JWT_SECRET =
      "test-member-link-secret-with-at-least-32-characters";
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.sendEmail.mockResolvedValue({ success: true, messageId: "accepted" });
    mocks.beginTransaction.mockResolvedValue(undefined);
    mocks.commit.mockResolvedValue(undefined);
    mocks.rollback.mockResolvedValue(undefined);
  });

  it("stores only token/code hashes and never returns the OTP", async () => {
    mocks.connectionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.includes("COUNT(*) AS requestCount")) {
        return [[{ requestCount: 0 }], []];
      }
      if (sql.includes("INSERT INTO bw_member_link_challenges")) {
        return [{ insertId: 81 }, []];
      }
      return [{ affectedRows: 1 }, []];
    });

    const { requestMemberWalletLinkChallenge } = await import(
      "./beautyWalletMemberLinkService"
    );
    const result = await requestMemberWalletLinkChallenge({
      lineUserId: 42,
      email: " Verified@Example.com ",
      req: { ip: "203.0.113.10" },
    });

    expect(result.maskedEmail).toBe("ve******@example.com");
    expect(result.challengeToken).toHaveLength(43);
    expect(result).not.toHaveProperty("code");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);

    const insertCall = mocks.connectionQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO bw_member_link_challenges")
    );
    const params = insertCall?.[1] as unknown[];
    expect(params[1]).toBe("verified@example.com");
    expect(params[3]).toMatch(/^[a-f0-9]{64}$/);
    expect(params[4]).toMatch(/^[a-f0-9]{64}$/);
    expect(params[3]).not.toBe(result.challengeToken);
    expect(
      mocks.connectionQuery.mock.calls.filter(([sql]) =>
        String(sql).includes("GET_LOCK")
      )
    ).toHaveLength(3);
    const sentContent = mocks.sendEmail.mock.calls[0][0].content as string;
    const code = sentContent.match(/\b\d{6}\b/)?.[0];
    expect(code).toMatch(/^\d{6}$/);
    expect(params[4]).not.toBe(code);
  });

  it("links the verified Beauty Wallet atomically without changing any point balance", async () => {
    const token = "a".repeat(43);
    const code = "135790";
    const expiresAt = new Date(Date.now() + 60_000);
    mocks.resolveCustomer.mockResolvedValue({
      found: true,
      customer: { id: 7001, name: "Verified", hasWallet: true },
    });
    mocks.auditLedger.mockResolvedValue({
      centralLedgerAvailable: true,
      historyComplete: true,
      unifiedTotal: 6255,
    });
    mocks.connectionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.includes("WHERE lineUserId=? AND tokenHash=?")) {
        return [[{
          id: 91,
          email: "verified@example.com",
          emailHash: "f".repeat(64),
          codeHash: otpHash(token, code),
          attemptCount: 0,
          status: "pending",
          expiresAt,
        }], []];
      }
      if (
        sql.includes("FROM bw_member_link_challenges") &&
        sql.includes("WHERE id=? FOR UPDATE")
      ) {
        return [[{ status: "pending", attemptCount: 0, expiresAt }], []];
      }
      if (sql.includes("FROM bw_wallet_active_owners")) return [[], []];
      if (
        sql.includes("WHERE bwCustomerId=?") &&
        sql.includes("lineUserId<>?")
      ) {
        return [[], []];
      }
      if (sql.includes("FROM bw_linked_accounts WHERE lineUserId=?")) {
        return [[], []];
      }
      return [{ affectedRows: 1, insertId: 1 }, []];
    });

    const { confirmMemberWalletLink } = await import(
      "./beautyWalletMemberLinkService"
    );
    const result = await confirmMemberWalletLink({
      lineUserId: 42,
      challengeToken: token,
      code,
    });

    expect(result).toEqual({
      linked: true,
      primaryLedger: "beauty_wallet",
      maskedEmail: "ve******@example.com",
      centralLedgerAvailable: true,
      unifiedTotal: 6255,
    });
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    const allSql = mocks.connectionQuery.mock.calls
      .map(([sql]) => String(sql))
      .join("\n");
    expect(allSql).toContain("GET_LOCK");
    expect(allSql).toContain("INSERT INTO bw_linked_accounts");
    expect(allSql).toContain("INSERT INTO bw_wallet_active_owners");
    expect(allSql).toContain("event,bwCustomerId,emailHash");
    expect(allSql).not.toMatch(/line_point_balances/i);
    expect(allSql).not.toMatch(/line_point_transactions/i);
  });

  it("blocks a wallet already owned by another active LCJ member", async () => {
    const token = "b".repeat(43);
    const code = "246802";
    const expiresAt = new Date(Date.now() + 60_000);
    mocks.resolveCustomer.mockResolvedValue({
      found: true,
      customer: { id: 7001, name: "Verified", hasWallet: true },
    });
    mocks.connectionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.includes("WHERE lineUserId=? AND tokenHash=?")) {
        return [[{
          id: 92,
          email: "verified@example.com",
          emailHash: "e".repeat(64),
          codeHash: otpHash(token, code),
          attemptCount: 0,
          status: "pending",
          expiresAt,
        }], []];
      }
      if (
        sql.includes("FROM bw_member_link_challenges") &&
        sql.includes("WHERE id=? FOR UPDATE")
      ) {
        return [[{ status: "pending", attemptCount: 0, expiresAt }], []];
      }
      if (sql.includes("FROM bw_wallet_active_owners")) {
        return [[{ lineUserId: 99, bwCustomerId: 7001 }], []];
      }
      if (
        sql.includes("WHERE bwCustomerId=?") &&
        sql.includes("lineUserId<>?")
      ) {
        return [[{ lineUserId: 99 }], []];
      }
      return [{ affectedRows: 1 }, []];
    });

    const { confirmMemberWalletLink } = await import(
      "./beautyWalletMemberLinkService"
    );
    await expect(
      confirmMemberWalletLink({ lineUserId: 42, challengeToken: token, code })
    ).rejects.toThrow("別の連携に使用されています");
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalled();
  });

  it("fails startup readiness when the migration schema is missing and never creates tables", async () => {
    mocks.poolQuery.mockResolvedValue([[], []]);
    const { ensureBeautyWalletMemberLinkSchema } = await import(
      "./beautyWalletMemberLinkService"
    );

    await expect(ensureBeautyWalletMemberLinkSchema()).rejects.toThrow(
      "schema is incomplete"
    );
    const sql = mocks.poolQuery.mock.calls.map(([query]) => String(query)).join("\n");
    expect(sql).not.toMatch(/CREATE\s+TABLE/i);
  });

  it("locks the challenge on the fifth wrong code before any central lookup", async () => {
    const token = "c".repeat(43);
    const expiresAt = new Date(Date.now() + 60_000);
    mocks.connectionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.includes("WHERE lineUserId=? AND tokenHash=?")) {
        return [[{
          id: 93,
          email: "verified@example.com",
          emailHash: "d".repeat(64),
          codeHash: otpHash(token, "111111"),
          attemptCount: 4,
          status: "pending",
          expiresAt,
        }], []];
      }
      return [{ affectedRows: 1 }, []];
    });

    const { confirmMemberWalletLink } = await import(
      "./beautyWalletMemberLinkService"
    );
    await expect(
      confirmMemberWalletLink({
        lineUserId: 42,
        challengeToken: token,
        code: "222222",
      })
    ).rejects.toThrow("確認コードが正しくありません");

    const update = mocks.connectionQuery.mock.calls.find(([sql]) =>
      String(sql).includes("status=IF(attemptCount+1>=?")
    );
    expect(update?.[1]).toEqual([5, 93]);
    expect(mocks.resolveCustomer).not.toHaveBeenCalled();
    expect(mocks.beginTransaction).not.toHaveBeenCalled();
  });

  it("rejects a replayed consumed challenge before any central lookup", async () => {
    mocks.connectionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (sql.includes("WHERE lineUserId=? AND tokenHash=?")) {
        return [[{ id: 94, status: "consumed" }], []];
      }
      return [{ affectedRows: 1 }, []];
    });

    const { confirmMemberWalletLink } = await import(
      "./beautyWalletMemberLinkService"
    );
    await expect(
      confirmMemberWalletLink({
        lineUserId: 42,
        challengeToken: "d".repeat(43),
        code: "333333",
      })
    ).rejects.toThrow("確認コードが無効です");
    expect(mocks.resolveCustomer).not.toHaveBeenCalled();
    expect(mocks.beginTransaction).not.toHaveBeenCalled();
  });
});
