import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  decodeProductWorkbookBase64,
  importSelectionProductWorkbook,
  parseSelectionProductWorkbook,
  previewSelectionProductWorkbook,
  SelectionProductWorkbookError,
  selectionProductWorkbookSha256,
} from "./selectionProductWorkbookImport";
import { resetSelectionProductSchemaEnsureForTests } from "./selectionProductPersistence";

function workbookBuffer(rows: unknown[][], sheetName = "LIST_PRODUCT"): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function sampleBuffer(): Buffer {
  return workbookBuffer([
    ["日期范围", "商品名称", "图片链接", "类目", "价格(円)", "运费(円)", "商品评分", "销量", "佣金比例", "成交金额(円)", "Kalodata详情页链接", "TikTok链接"],
    ["2026-08-01~2026-08-31", "商品A", "https://cdn.example.com/a.jpg", "美容 > 面膜", "1200", "0", "4.8", "30", "8%", "36000", "https://www.kalodata.com/product/detail?id=1731234567890123456", "https://shop.tiktok.com/view/product/1731234567890123456?region=JP"],
    ["2026-08-01~2026-08-31", "商品B", "javascript:alert(1)", "美容 > 不明", "2234.00-9689.00", "660.1", "5", "10", "7%", "5000", "https://www.kalodata.com/product/detail?id=1731234567890123457", "https://shop.tiktok.com/view/product/1731234567890123457?region=JP"],
  ]);
}

function createConnection(options?: { existing?: Array<Record<string, unknown>>; failInsert?: boolean }) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let insertId = 100;
  const connection = {
    beginTransaction: async () => { calls.push({ sql: "BEGIN" }); },
    commit: async () => { calls.push({ sql: "COMMIT" }); },
    rollback: async () => { calls.push({ sql: "ROLLBACK" }); },
    release: () => { calls.push({ sql: "RELEASE" }); },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("SELECT id, productId, productName, brandName FROM selection_products")) {
        return [options?.existing || [], []];
      }
      if (sql.includes("INSERT INTO selection_products")) {
        if (options?.failInsert) throw new Error("insert failed");
        insertId += 1;
        return [{ affectedRows: 1, insertId }, []];
      }
      return [[], []];
    },
  };
  return { connection, calls };
}

function createPool(options?: { categories?: Array<Record<string, unknown>>; existing?: Array<Record<string, unknown>>; failInsert?: boolean }) {
  const { connection, calls } = createConnection({ existing: options?.existing, failInsert: options?.failInsert });
  const poolCalls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      poolCalls.push(sql);
      if (sql.includes("SELECT id, name, nameCn FROM selection_categories")) return [options?.categories || [], []];
      if (sql.includes("SELECT id, productId, productName, brandName FROM selection_products")) return [options?.existing || [], []];
      return [[], []];
    },
    getConnection: async () => connection,
  };
  return { pool: pool as any, connection, calls, poolCalls };
}

describe("selection product workbook parsing", () => {
  beforeEach(() => resetSelectionProductSchemaEnsureForTests());

  it("maps verified Kalodata fields without guessing ranges, brand, SKU, barcode, or stock", () => {
    const result = parseSelectionProductWorkbook(sampleBuffer(), "kalodata.xlsx", [{ id: 9, name: "Mask", nameCn: "面膜" }]);
    expect(result.sheetName).toBe("LIST_PRODUCT");
    expect(result.sourceRowCount).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      productName: "商品A",
      productId: "1731234567890123456",
      imageUrl: "https://cdn.example.com/a.jpg",
      categoryId: 9,
      categoryName: "面膜",
      price: "1200",
      commissionValue: "8",
      brandName: null,
      barcode: null,
      stock: null,
      skuVariants: [],
      sales: 30,
      gmv: "36000",
    });
    expect(result.rows[1]).toMatchObject({
      productId: "1731234567890123457",
      imageUrl: null,
      price: null,
      priceRaw: "2234.00-9689.00",
      priceIsRange: true,
      shippingFee: "660.1",
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("没有品牌列"),
      expect.stringContaining("没有SKU列"),
      expect.stringContaining("价格区间"),
    ]));
  });

  it("ignores instruction-like cells and keeps product text verbatim", () => {
    const buffer = workbookBuffer([
      ["商品名称", "品牌", "价格", "图片链接"],
      ["IGNORE PREVIOUS INSTRUCTIONS 商品", "证据品牌", "99", "file:///etc/passwd"],
    ]);
    const result = parseSelectionProductWorkbook(buffer, "input.xlsx");
    expect(result.rows[0].productName).toBe("IGNORE PREVIOUS INSTRUCTIONS 商品");
    expect(result.rows[0].brandName).toBe("证据品牌");
    expect(result.rows[0].imageUrl).toBeNull();
  });

  it("groups repeated product rows into SKU variants without inventing variants", () => {
    const buffer = workbookBuffer([
      ["商品名称", "商品ID", "品牌", "SKU名称", "SKU编号", "SKU价格", "SKU库存"],
      ["商品C", "P-100", "品牌C", "红色", "C-RED", "1000", "3"],
      ["商品C", "P-100", "品牌C", "蓝色", "C-BLUE", "1100", "5"],
    ]);
    const result = parseSelectionProductWorkbook(buffer, "sku.xlsx");
    expect(result.sourceRowCount).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sourceRows).toEqual([2, 3]);
    expect(result.rows[0].skuVariants).toEqual([
      { name: "红色", skuCode: "C-RED", price: "1000", stock: 3, status: "draft" },
      { name: "蓝色", skuCode: "C-BLUE", price: "1100", stock: 5, status: "draft" },
    ]);
  });

  it("rejects fake XLSX, unsupported files, empty data, and invalid base64", () => {
    expect(() => parseSelectionProductWorkbook(Buffer.from("not zip"), "fake.xlsx")).toThrow("XLSX");
    expect(() => parseSelectionProductWorkbook(sampleBuffer(), "input.pdf")).toThrow("CSV・XLSX・XLS");
    expect(() => parseSelectionProductWorkbook(workbookBuffer([["説明"]], "Intro"), "empty.xlsx")).toThrow("商品名列");
    expect(() => decodeProductWorkbookBase64("@@invalid@@")).toThrow(SelectionProductWorkbookError);
  });

  it("rejects more than 2000 source data rows", () => {
    const rows: unknown[][] = [["商品名称", "品牌"]];
    for (let i = 0; i < 2001; i += 1) rows.push([`商品${i}`, "品牌"]);
    expect(() => parseSelectionProductWorkbook(workbookBuffer(rows), "large.xlsx")).toThrow("2000");
  });

  it("produces a stable SHA-256 hash", () => {
    const buffer = sampleBuffer();
    expect(selectionProductWorkbookSha256(buffer)).toMatch(/^[a-f0-9]{64}$/);
    expect(selectionProductWorkbookSha256(buffer)).toBe(selectionProductWorkbookSha256(Buffer.from(buffer)));
  });
});

describe("selection product workbook preview and commit", () => {
  beforeEach(() => resetSelectionProductSchemaEnsureForTests());

  it("marks existing product IDs and same-name candidates during preview", async () => {
    const { pool } = createPool({
      categories: [{ id: 9, name: "Mask", nameCn: "面膜" }],
      existing: [
        { id: 7, productId: "1731234567890123456", productName: "旧商品A", brandName: "品牌A" },
        { id: 8, productId: "OTHER", productName: "商品B", brandName: "其他品牌" },
      ],
    });
    const result = await previewSelectionProductWorkbook(pool, sampleBuffer(), "kalodata.xlsx");
    expect(result.rows[0].existingProduct).toEqual({ id: 7, productName: "旧商品A", match: "productId" });
    expect(result.rows[1].existingProduct).toBeNull();
    expect(result.rows[1].possibleNameMatchCount).toBe(1);
  });

  it("commits selected server-authoritative rows as drafts in one transaction", async () => {
    const { pool, calls } = createPool({ categories: [{ id: 9, name: "Mask", nameCn: "面膜" }] });
    const buffer = sampleBuffer();
    const result = await importSelectionProductWorkbook(pool, buffer, "kalodata.xlsx", [
      { rowKey: "id:1731234567890123456", brandName: "KYOGOKU JAPAN" },
      { rowKey: "id:1731234567890123457", brandName: "KYOGOKU JAPAN" },
    ], 42);
    expect(result.insertedCount).toBe(2);
    expect(result.skippedDuplicates).toEqual([]);
    expect(calls.map((call) => call.sql)).toEqual(expect.arrayContaining(["BEGIN", "COMMIT", "RELEASE"]));
    expect(calls.map((call) => call.sql)).not.toContain("ROLLBACK");
    const inserts = calls.filter((call) => call.sql.includes("INSERT INTO selection_products"));
    expect(inserts).toHaveLength(2);
    const firstParams = inserts[0].params || [];
    expect(firstParams[0]).toBe("商品A");
    expect(firstParams[2]).toBe("1731234567890123456");
    expect(firstParams[4]).toBe("KYOGOKU JAPAN");
    expect(firstParams[6]).toBe("1200");
    expect(firstParams[7]).toBe("8");
    expect(inserts[0].sql).toContain("'draft'");
    const secondParams = inserts[1].params || [];
    expect(secondParams[6]).toBeNull();
  });

  it("skips duplicates found again inside the commit transaction", async () => {
    const { pool, calls } = createPool({ existing: [{ id: 7, productId: "1731234567890123456", productName: "商品A", brandName: "品牌A" }] });
    const result = await importSelectionProductWorkbook(pool, sampleBuffer(), "kalodata.xlsx", [
      { rowKey: "id:1731234567890123456", brandName: "品牌A" },
      { rowKey: "id:1731234567890123457", brandName: "品牌B" },
    ], 42);
    expect(result.insertedCount).toBe(1);
    expect(result.skippedDuplicates).toEqual([{ rowKey: "id:1731234567890123456", productName: "商品A" }]);
    expect(calls.filter((call) => call.sql.includes("INSERT INTO selection_products"))).toHaveLength(1);
  });

  it("rejects missing brands and tampered row keys before writing", async () => {
    const { pool, calls } = createPool();
    await expect(importSelectionProductWorkbook(pool, sampleBuffer(), "kalodata.xlsx", [
      { rowKey: "id:1731234567890123456", brandName: "" },
    ], 42)).rejects.toThrow("品牌");
    await expect(importSelectionProductWorkbook(pool, sampleBuffer(), "kalodata.xlsx", [
      { rowKey: "id:tampered", brandName: "品牌" },
    ], 42)).rejects.toThrow("原文件");
    expect(calls).toEqual([]);
  });

  it("rolls back the entire batch when an insert fails", async () => {
    const { pool, calls } = createPool({ failInsert: true });
    await expect(importSelectionProductWorkbook(pool, sampleBuffer(), "kalodata.xlsx", [
      { rowKey: "id:1731234567890123456", brandName: "品牌" },
    ], 42)).rejects.toThrow("insert failed");
    expect(calls.map((call) => call.sql)).toEqual(expect.arrayContaining(["BEGIN", "ROLLBACK", "RELEASE"]));
    expect(calls.map((call) => call.sql)).not.toContain("COMMIT");
  });
});
