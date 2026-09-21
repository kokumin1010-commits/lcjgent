import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mergePointComponents } from "./memberAccountMergeService";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("member account merge under Beauty Wallet primary-ledger policy", () => {
  it("retains the deterministic audit calculation without executing a merge", () => {
    expect(mergePointComponents(
      { balance: 33, totalEarned: 33, totalUsed: 0 },
      { balance: 3500, totalEarned: 3500, totalUsed: 0 }
    )).toEqual({ balance: 3533, totalEarned: 3533, totalUsed: 0 });
  });

  it("fails closed in both the admin route and merge service", () => {
    const router = read("server/memberIdentityRouter.ts");
    const service = read("server/memberAccountMergeService.ts");
    expect(router).toContain("LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE");
    expect(service).toContain('assertLocalPointLedgerWritable("member_account_point_merge")');
  });

  it("keeps the central Beauty Wallet audit read-only and admin protected", () => {
    const router = read("server/memberIdentityRouter.ts");
    const api = read("server/bw-api.ts");
    expect(router).toContain("auditBeautyWalletLedger: protectedProcedure");
    expect(router).toContain('ctx.user.role !== "admin"');
    expect(router).toContain("bwAuditCentralLedgerByEmail(input.email)");
    const start = api.indexOf("export async function bwAuditCentralLedgerByEmail");
    const end = api.indexOf("/**\n * BW側にトークンを付与", start);
    const audit = api.slice(start, end);
    expect(audit).toContain("bwLookupCustomerReadOnly");
    expect(audit).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE TABLE)\b/);
  });

  it.each(["client/src/pages/MemberDetail.tsx", "client/src/pages/MallMembers.tsx"])(
    "shows the legacy point ledger as read-only in %s",
    file => {
      const page = read(file);
      expect(page).toContain("Beauty Wallet");
      expect(page).toMatch(/読み取り専用|過去のLCJ残高と取引履歴のみ確認/);
      expect(page).not.toContain("adjustPointsMutation.mutate");
    }
  );
});
