import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mergePointComponents } from "./memberAccountMergeService";

const root = path.resolve(__dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("member account point merge", () => {
  it("moves existing components without minting or dropping points", () => {
    const merged = mergePointComponents(
      { balance: 33, totalEarned: 33, totalUsed: 0 },
      { balance: 3500, totalEarned: 3500, totalUsed: 0 }
    );
    expect(merged).toEqual({ balance: 3533, totalEarned: 3533, totalUsed: 0 });
  });

  it("requires exact identities and balances before the destructive merge", () => {
    const source = read("server/memberAccountMergeService.ts");
    expect(source).toContain("target member email changed; merge cancelled");
    expect(source).toContain("source LINE identity changed; merge cancelled");
    expect(source).toContain(
      "target point balance changed; reload before merging"
    );
    expect(source).toContain(
      "source point balance changed; reload before merging"
    );
    expect(source).toContain("FOR UPDATE");
    expect(source).toContain("beginTransaction");
    expect(source).toContain("rollback");
  });

  it("preserves totals, ledger rows and original expiration evidence instead of issuing replacement points", () => {
    const source = read("server/memberAccountMergeService.ts");
    expect(source).toContain("UPDATE line_point_transactions SET lineUserId=?");
    expect(source).toContain("recalculatePointLedger");
    expect(source).toContain("point ledger mismatch after merge");
    expect(source).not.toContain("createLinePointTransaction");
    expect(source).not.toMatch(/INSERT INTO line_point_transactions/i);
  });

  it("backs up and audits the identity merge while making retries idempotent", () => {
    const source = read("server/memberAccountMergeService.ts");
    expect(source).toContain("pre-member-account-merge-v1");
    expect(source).toContain("post-member-account-merge-v1");
    expect(source).toContain(
      "runDatabaseBackup(reason, { force: true, waitForActive: true })"
    );
    expect(source).toContain("member_account_merge_audit");
    expect(source).toContain("uq_member_account_merge_source");
    expect(source).toContain("alreadyMerged: true");
    expect(source).toContain("expectedEmailHash");
  });

  it("migrates both string point keys and numeric member references before removing the duplicate row", () => {
    const source = read("server/memberAccountMergeService.ts");
    const mergeFlow = source.slice(source.indexOf("const stringKeyMigrations"));
    const migrateStringIndex = mergeFlow.indexOf("migrateStringPointKeys(");
    const migrateNumericIndex = mergeFlow.indexOf("migrateNumericMemberIds(");
    const deleteSourceIndex = mergeFlow.indexOf(
      "DELETE FROM line_users WHERE id=?"
    );
    expect(migrateStringIndex).toBeGreaterThanOrEqual(0);
    expect(migrateNumericIndex).toBeGreaterThanOrEqual(0);
    expect(deleteSourceIndex).toBeGreaterThan(migrateStringIndex);
    expect(deleteSourceIndex).toBeGreaterThan(migrateNumericIndex);
    expect(source).toContain("mergeTrustLevels");
  });
});

describe("member account merge authorization and operator safety", () => {
  it("exposes only an admin-protected merge with risk restrictions", () => {
    const router = read("server/memberIdentityRouter.ts");
    expect(router).toContain("mergeEmailAndLineAccounts: protectedProcedure");
    expect(router).toContain('ctx.user.role !== "admin"');
    expect(router).toMatch(
      /assertMemberActionAllowed\(input\.targetEmailMemberId,\s*\[\s*"points",\s*"order",?\s*\]\)/
    );
    expect(router).toMatch(
      /assertMemberActionAllowed\(input\.sourceLineMemberId,\s*\[\s*"points",\s*"order",?\s*\]\)/
    );
    expect(router).toContain("expectedTargetBalance");
    expect(router).toContain("expectedSourceBalance");
  });

  it.each([
    "client/src/pages/MemberDetail.tsx",
    "client/src/pages/MallMembers.tsx",
  ])(
    "requires a visible identity confirmation before manual point changes in %s",
    file => {
      const page = read(file);
      expect(page).toContain("window.confirm");
      expect(page).toContain("会員ID:");
      expect(page).toContain("メール:");
      expect(page).toContain("本人確認:");
      expect(page).toContain("同名の別会員ではないことを確認してください。");
    }
  );
});
