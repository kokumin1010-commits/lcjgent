import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeFinanceImportDocument,
  createFinanceImportDocument,
  listFinanceImportDocuments,
  normalizeFinanceImportFileName,
  resetFinanceImportEvidenceForTests,
} from "./financeImportEvidence";

function createPoolMock(responses: unknown[] = []) {
  const query = vi.fn(async () => {
    const next = responses.shift();
    return (next ?? [{ affectedRows: 1 }, []]) as any;
  });
  return { query } as any;
}

beforeEach(() => {
  resetFinanceImportEvidenceForTests();
});

describe("finance import evidence", () => {
  it("normalizes unsafe names without losing the visible original name", () => {
    expect(normalizeFinanceImportFileName("  bank\u0000statement.csv  ")).toBe("bankstatement.csv");
  });

  it("persists the private source file before returning an import batch", async () => {
    const pool = createPoolMock([
      [{ affectedRows: 0 }, []],
      [{ insertId: 42 }, []],
      [{ affectedRows: 1 }, []],
    ]);
    const putObject = vi.fn(async (key: string) => ({ key, url: "private" }));
    const source = Buffer.from("date,amount\n2026-08-29,100\n").toString("base64");

    const result = await createFinanceImportDocument({
      module: "bank_statement",
      sourceFileName: "statement.csv",
      sourceFileBase64: source,
      sourceMimeType: "text/csv",
      entity: "japan",
      createdBy: 7,
      createdByName: "Finance User",
    }, { pool, putObject: putObject as any });

    expect(result).toMatchObject({ id: 42, sourceFileName: "statement.csv", originalFileSaved: true });
    expect(result.sourceFileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(putObject).toHaveBeenCalledOnce();
    expect(String(putObject.mock.calls[0]?.[0])).toContain("private/finance-imports/bank_statement/");
    expect(pool.query.mock.calls[2]?.[0]).toContain("sourceStorageKey");
  });

  it("does not permit business import when private storage fails", async () => {
    const pool = createPoolMock([
      [{ affectedRows: 0 }, []],
      [{ insertId: 9 }, []],
      [{ affectedRows: 1 }, []],
    ]);
    const source = Buffer.from("date,amount\n2026-08-29,100\n").toString("base64");
    await expect(createFinanceImportDocument({
      module: "bank_statement",
      sourceFileName: "statement.csv",
      sourceFileBase64: source,
    }, {
      pool,
      putObject: vi.fn(async () => { throw new Error("storage unavailable"); }) as any,
    })).rejects.toThrow("未执行导入");
    expect(pool.query.mock.calls[2]?.[0]).toContain("status='failed'");
  });

  it("marks a saved batch completed with exact row counts", async () => {
    const pool = createPoolMock([
      [{ affectedRows: 0 }, []],
      [{ affectedRows: 1 }, []],
    ]);
    await completeFinanceImportDocument(12, {
      recordCount: 100,
      importedCount: 97,
      skippedCount: 2,
      errorCount: 1,
      relatedImportId: 300,
    }, { pool });
    expect(pool.query.mock.calls[1]?.[1]).toEqual([100, 97, 2, 1, 300, null, 12]);
  });

  it("returns only a short hash and never exposes the private storage key", async () => {
    const pool = createPoolMock([
      [{ affectedRows: 0 }, []],
      [[{
        id: 1,
        module: "payroll",
        entity: "japan",
        brandId: null,
        reportMonth: "2026-08",
        sourceFileName: "payroll.xlsx",
        sourceFileSha256: "a".repeat(64),
        sourceFileSize: 1024,
        sourceMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sourceStorageKey: "private/finance-imports/payroll/secret.xlsx",
        recordCount: 10,
        importedCount: 10,
        skippedCount: 0,
        errorCount: 0,
        status: "completed",
        errorMessage: null,
        details: null,
        relatedImportId: 2,
        createdBy: 7,
        createdByName: "Finance User",
        createdAt: new Date("2026-08-29T00:00:00Z"),
        completedAt: new Date("2026-08-29T00:01:00Z"),
      }], []],
    ]);
    const rows = await listFinanceImportDocuments({ limit: 10 }, { pool });
    expect(rows[0]?.sourceFileSha256Short).toBe("a".repeat(12));
    expect(rows[0]?.originalFileSaved).toBe(true);
    expect(rows[0]).not.toHaveProperty("sourceStorageKey");
    expect(JSON.stringify(rows[0])).not.toContain("private/finance-imports");
  });
});
