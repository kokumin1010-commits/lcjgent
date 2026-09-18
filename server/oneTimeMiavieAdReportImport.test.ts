import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authorizeOneTimeMiavieImport } from "./oneTimeMiavieAdReportImport";

const read = (path: string) => readFileSync(path, "utf8");

describe("one-time MIAVIE ad report import", () => {
  it("rejects missing and arbitrary tokens", () => {
    expect(authorizeOneTimeMiavieImport(undefined)).toBe(false);
    expect(authorizeOneTimeMiavieImport("wrong-token")).toBe(false);
  });

  it("accepts only the authorized PDF and one exact active target store", () => {
    const source = read("server/oneTimeMiavieAdReportImport.ts");
    expect(source).toContain('EXPECTED_FILE_SHA256 = "16b798850a6e402d577e15d26a90cdff3b1e6b2462d91d0bb10345c2349c6b58"');
    expect(source).toContain("inspected.sha256 !== EXPECTED_FILE_SHA256");
    expect(source).toContain('TARGET_STORE_NAME = "buzzdrop"');
    expect(source).toContain("storeRows.length !== 1");
    expect(source).toContain("Authorized PDF already belongs to another store");
    expect(source).toContain("duplicate: true");
    expect(source).not.toContain("1_888_693");
    expect(source).not.toContain("432_384");
  });

  it("hides unauthorized access and disables caching", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain('app.post("/api/one-time/miavie-ad-report"');
    expect(index).toContain('res.setHeader("Cache-Control", "no-store, private, max-age=0")');
    expect(index).toContain('return res.status(404).json({ error: "Not found" })');
    expect(index).toContain('req.headers["x-one-time-token"]');
  });
});
