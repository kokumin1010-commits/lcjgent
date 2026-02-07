import { describe, it, expect } from "vitest";

// ---- Helper functions (copied from index.ts for unit testing) ----
function csvParseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function csvMapHeadersToValues(headers: string[], values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < headers.length && i < values.length; i++) {
    result[headers[i]] = values[i];
  }
  return result;
}

function csvTruncate(val: string | null, maxLen: number): string | null {
  if (val === null || val === undefined) return null;
  if (val.length <= maxLen) return val;
  return val.substring(0, maxLen);
}

function csvSanitizeErrorMessage(msg: string): string {
  if (!msg) return "不明なエラーが発生しました";
  const cutPatterns = [/\s*params:.*$/i, /\s*values\s*\(.*$/i, /\s*\[.*\]$/];
  let cleaned = msg;
  for (const pattern of cutPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 200) + "...";
  }
  return cleaned || "不明なエラーが発生しました";
}

// ---- Tests for Bug Fix ----
describe("CSV Bug Fix - SubOrderId Splitting", () => {
  it("should split comma-separated subOrderIds into individual records", () => {
    const headers = ["注文ID", "サブ注文ID", "商品名", "価格", "数量", "ショップ名", "ショップコード", "コンテンツタイプ", "コンテンツID", "注文状況"];
    const csvLine = '"ORD001","SUB001,SUB002,SUB003","テスト商品","1000","1","テストショップ","SHOP01","ライブ","CONTENT001","完了"';
    
    const values = csvParseCSVLine(csvLine);
    const row = csvMapHeadersToValues(headers, values);
    const rawSubOrderId = String(row["サブ注文ID"] || "");
    
    // Verify the raw value contains commas
    expect(rawSubOrderId).toBe("SUB001,SUB002,SUB003");
    
    // Simulate the splitting logic from index.ts
    const orders: Record<string, string>[] = [];
    if (rawSubOrderId.includes(",")) {
      const subIds = rawSubOrderId.split(",").map(s => s.trim()).filter(s => s);
      for (const subId of subIds) {
        const clonedRow = { ...row, "サブ注文ID": subId };
        orders.push(clonedRow);
      }
    } else {
      orders.push(row);
    }
    
    expect(orders.length).toBe(3);
    expect(orders[0]["サブ注文ID"]).toBe("SUB001");
    expect(orders[1]["サブ注文ID"]).toBe("SUB002");
    expect(orders[2]["サブ注文ID"]).toBe("SUB003");
    // Other fields should be preserved
    expect(orders[0]["注文ID"]).toBe("ORD001");
    expect(orders[1]["注文ID"]).toBe("ORD001");
    expect(orders[2]["注文ID"]).toBe("ORD001");
    expect(orders[0]["商品名"]).toBe("テスト商品");
  });

  it("should handle single subOrderId without splitting", () => {
    const rawSubOrderId = "SUB001";
    const orders: string[] = [];
    
    if (rawSubOrderId.includes(",")) {
      const subIds = rawSubOrderId.split(",").map(s => s.trim()).filter(s => s);
      orders.push(...subIds);
    } else {
      orders.push(rawSubOrderId);
    }
    
    expect(orders.length).toBe(1);
    expect(orders[0]).toBe("SUB001");
  });

  it("should handle many comma-separated subOrderIds (like the real bug)", () => {
    // Simulate the real bug: 381 characters of comma-separated IDs
    const ids = Array.from({ length: 20 }, (_, i) => `SUB${String(i).padStart(10, '0')}`);
    const rawSubOrderId = ids.join(",");
    
    expect(rawSubOrderId.length).toBeGreaterThan(64); // Exceeds varchar(64)
    
    const subIds = rawSubOrderId.split(",").map(s => s.trim()).filter(s => s);
    expect(subIds.length).toBe(20);
    
    // Each individual ID should fit in varchar(64)
    for (const id of subIds) {
      expect(id.length).toBeLessThanOrEqual(64);
    }
  });

  it("should handle subOrderIds with spaces around commas", () => {
    const rawSubOrderId = "SUB001 , SUB002 , SUB003";
    const subIds = rawSubOrderId.split(",").map(s => s.trim()).filter(s => s);
    
    expect(subIds).toEqual(["SUB001", "SUB002", "SUB003"]);
  });

  it("should handle empty subOrderId after splitting", () => {
    const rawSubOrderId = "SUB001,,SUB003";
    const subIds = rawSubOrderId.split(",").map(s => s.trim()).filter(s => s);
    
    expect(subIds).toEqual(["SUB001", "SUB003"]);
  });
});

describe("CSV Bug Fix - String Length Validation (csvTruncate)", () => {
  it("should return null for null input", () => {
    expect(csvTruncate(null, 64)).toBeNull();
  });

  it("should return string unchanged if within limit", () => {
    expect(csvTruncate("short", 64)).toBe("short");
  });

  it("should return string unchanged if exactly at limit", () => {
    const str = "a".repeat(64);
    expect(csvTruncate(str, 64)).toBe(str);
    expect(csvTruncate(str, 64)!.length).toBe(64);
  });

  it("should truncate string exceeding limit", () => {
    const str = "a".repeat(100);
    const result = csvTruncate(str, 64);
    expect(result!.length).toBe(64);
  });

  it("should handle very long subOrderId (381 chars like real bug)", () => {
    const longId = "a".repeat(381);
    const result = csvTruncate(longId, 64);
    expect(result!.length).toBe(64);
  });

  it("should handle empty string", () => {
    expect(csvTruncate("", 64)).toBe("");
  });

  it("should handle various field lengths", () => {
    // orderId: varchar(64)
    expect(csvTruncate("a".repeat(100), 64)!.length).toBe(64);
    // orderStatus: varchar(50)
    expect(csvTruncate("a".repeat(60), 50)!.length).toBe(50);
    // platform: varchar(20)
    expect(csvTruncate("a".repeat(30), 20)!.length).toBe(20);
  });
});

describe("CSV Bug Fix - Error Message Sanitization", () => {
  it("should sanitize SQL error with params dump", () => {
    const errorMsg = 'INSERT INTO tiktok_commission_orders failed params: ["val1","val2","val3"... 58KB of data]';
    const result = csvSanitizeErrorMessage(errorMsg);
    expect(result).not.toContain("val1");
    expect(result.length).toBeLessThanOrEqual(203); // 200 + "..."
  });

  it("should sanitize SQL error with values dump", () => {
    const errorMsg = 'Data too long for column values (1234, "some data", "more data")';
    const result = csvSanitizeErrorMessage(errorMsg);
    expect(result).not.toContain("some data");
  });

  it("should truncate very long error messages", () => {
    const errorMsg = "Error: " + "x".repeat(500);
    const result = csvSanitizeErrorMessage(errorMsg);
    expect(result.length).toBeLessThanOrEqual(203);
    expect(result.endsWith("...")).toBe(true);
  });

  it("should preserve short safe error messages", () => {
    const errorMsg = "CSVファイルにデータがありません";
    const result = csvSanitizeErrorMessage(errorMsg);
    expect(result).toBe(errorMsg);
  });

  it("should handle empty error message", () => {
    const result = csvSanitizeErrorMessage("");
    expect(result).toBe("不明なエラーが発生しました");
  });

  it("should handle error with array dump at end", () => {
    const errorMsg = 'Some error occurred [1,2,3,4,5,"long data here"]';
    const result = csvSanitizeErrorMessage(errorMsg);
    expect(result).not.toContain("long data here");
  });

  it("should never return raw SQL parameters to client", () => {
    // Simulate the actual error that caused the 58KB display
    const fakeParams = Array.from({ length: 1000 }, (_, i) => `"value_${i}"`).join(",");
    const errorMsg = `Data too long for column 'subOrderId' at row 1 params: [${fakeParams}]`;
    const result = csvSanitizeErrorMessage(errorMsg);
    
    // Result should be short and not contain the params
    expect(result.length).toBeLessThanOrEqual(203);
    expect(result).not.toContain("value_999");
  });
});

describe("CSV Bug Fix - Integration: Full Row Processing", () => {
  it("should process a row with multi-subOrderId and truncate correctly", () => {
    const headers = ["注文ID", "サブ注文ID", "商品名", "価格", "数量", "ショップ名", "ショップコード", "コンテンツタイプ", "コンテンツID", "注文状況"];
    const longIds = Array.from({ length: 15 }, (_, i) => `SUB${String(i).padStart(15, '0')}`);
    const csvLine = `"ORD001","${longIds.join(",")}","テスト商品","1000","1","テストショップ","SHOP01","ライブ","CONTENT001","完了"`;
    
    const values = csvParseCSVLine(csvLine);
    const row = csvMapHeadersToValues(headers, values);
    const rawSubOrderId = String(row["サブ注文ID"] || "");
    
    // Raw value exceeds varchar(64)
    expect(rawSubOrderId.length).toBeGreaterThan(64);
    
    // After splitting, each ID fits
    const subIds = rawSubOrderId.split(",").map(s => s.trim()).filter(s => s);
    expect(subIds.length).toBe(15);
    for (const id of subIds) {
      const truncated = csvTruncate(id, 64);
      expect(truncated!.length).toBeLessThanOrEqual(64);
    }
  });

  it("should handle the complete flow: parse -> split -> truncate -> validate", () => {
    const headers = ["注文ID", "サブ注文ID", "注文状況", "クリエイターのユーザー名", "商品名", "SKU", "商品ID", "価格", "数量", "ショップ名"];
    const dataLine = '"ORD001","SUB001,SUB002","完了","creator1","テスト商品","SKU001","PROD001","1500","2","テストショップ"';
    
    const values = csvParseCSVLine(dataLine);
    const row = csvMapHeadersToValues(headers, values);
    const rawSubOrderId = String(row["サブ注文ID"] || "");
    
    const processedOrders: any[] = [];
    if (rawSubOrderId.includes(",")) {
      const subIds = rawSubOrderId.split(",").map(s => s.trim()).filter(s => s);
      for (const subId of subIds) {
        processedOrders.push({
          orderId: csvTruncate(String(row["注文ID"] || ""), 64),
          subOrderId: csvTruncate(subId, 64),
          orderStatus: csvTruncate(row["注文状況"] || null, 50),
          creatorUsername: csvTruncate(row["クリエイターのユーザー名"] || "", 255),
          productName: row["商品名"] || "",
        });
      }
    }
    
    expect(processedOrders.length).toBe(2);
    expect(processedOrders[0].subOrderId).toBe("SUB001");
    expect(processedOrders[1].subOrderId).toBe("SUB002");
    expect(processedOrders[0].orderId).toBe("ORD001");
    expect(processedOrders[1].orderId).toBe("ORD001");
  });
});
