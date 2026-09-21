import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mergePointComponents } from "./pointBalanceLinkRecovery";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("linked point recovery shutdown", () => {
  it("keeps the pure audit calculation deterministic", () => {
    expect(mergePointComponents(
      { balance: 12500, earned: 13050, used: 550 },
      { balance: 500, earned: 500, used: 0 }
    )).toEqual({ balance: 13000, earned: 13550, used: 550 });
  });

  it("fails closed at the recovery task entry", () => {
    const recovery = read("server/pointBalanceLinkRecovery.ts");
    expect(recovery).toContain("assertLocalPointLedgerWritable('point_balance_link_recovery')");
  });

  it("does not run any local point recovery or merge during service startup", () => {
    const startup = read("server/_core/index.ts");
    expect(startup).not.toContain("runPointBalanceLinkRecovery()");
    expect(startup).not.toContain("runMallPointMemberRecovery()");
    expect(startup).not.toContain("runPointRecoveryLedgerUpgrade()");
  });

  it("does not auto-merge local balances from a read path", () => {
    const db = read("server/db.ts");
    expect(db).not.toContain("Auto-merging orphaned point components");
  });
});
