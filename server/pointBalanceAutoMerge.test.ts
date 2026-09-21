import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve("server/db.ts"), "utf8");

describe("getLinePointBalance read-only safety", () => {
  it("does not merge email and LINE point components during a read", () => {
    const start = dbSource.indexOf("export async function getLinePointBalance");
    const end = dbSource.indexOf("export async function createLinePointTransaction", start);
    const implementation = dbSource.slice(start, end);
    expect(implementation).not.toContain("Auto-merging orphaned point components");
    expect(implementation).not.toContain("db.update(linePointBalances)");
    expect(implementation).not.toContain("db.update(linePointTransactions)");
  });

  it("keeps legacy local balances available only as audit reads", () => {
    expect(dbSource).toContain("export async function getLinePointBalance");
    expect(dbSource).toContain('assertLocalPointLedgerWritable("line_point_transaction")');
  });
});
