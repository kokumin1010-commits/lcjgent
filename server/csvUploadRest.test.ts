import { describe, it, expect } from "vitest";

// ---- CSV Helper functions (copied from index.ts for unit testing) ----
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

function csvParseIntSafe(val: string | undefined | null): number | null {
  if (!val || val === "" || val === "-") return null;
  const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function csvParseFloatSafe(val: string | undefined | null): number | null {
  if (!val || val === "" || val === "-") return null;
  const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function csvParseDateDDMMYYYY(val: string | undefined | null): Date | null {
  if (!val || val === "" || val === "-") return null;
  let match = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  match = val.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  match = val.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  match = val.match(/(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ---- Tests ----
describe("CSV Upload REST API - Helper Functions", () => {
  describe("csvParseCSVLine", () => {
    it("should parse simple CSV line", () => {
      const result = csvParseCSVLine("a,b,c,d");
      expect(result).toEqual(["a", "b", "c", "d"]);
    });

    it("should handle quoted fields", () => {
      const result = csvParseCSVLine('"hello, world",b,c');
      expect(result).toEqual(["hello, world", "b", "c"]);
    });

    it("should handle escaped quotes", () => {
      const result = csvParseCSVLine('"he said ""hello""",b');
      expect(result).toEqual(['he said "hello"', "b"]);
    });

    it("should handle empty fields", () => {
      const result = csvParseCSVLine("a,,c,");
      expect(result).toEqual(["a", "", "c", ""]);
    });

    it("should handle Japanese characters", () => {
      const result = csvParseCSVLine("注文ID,サブ注文ID,商品名");
      expect(result).toEqual(["注文ID", "サブ注文ID", "商品名"]);
    });

    it("should handle fields with spaces", () => {
      const result = csvParseCSVLine(" a , b , c ");
      expect(result).toEqual(["a", "b", "c"]);
    });
  });

  describe("csvMapHeadersToValues", () => {
    it("should map headers to values correctly", () => {
      const headers = ["注文ID", "商品名", "価格"];
      const values = ["12345", "テスト商品", "1000"];
      const result = csvMapHeadersToValues(headers, values);
      expect(result).toEqual({
        "注文ID": "12345",
        "商品名": "テスト商品",
        "価格": "1000",
      });
    });

    it("should handle mismatched lengths (more headers)", () => {
      const headers = ["a", "b", "c"];
      const values = ["1", "2"];
      const result = csvMapHeadersToValues(headers, values);
      expect(result).toEqual({ a: "1", b: "2" });
    });

    it("should handle mismatched lengths (more values)", () => {
      const headers = ["a", "b"];
      const values = ["1", "2", "3"];
      const result = csvMapHeadersToValues(headers, values);
      expect(result).toEqual({ a: "1", b: "2" });
    });
  });

  describe("csvParseIntSafe", () => {
    it("should parse valid integers", () => {
      expect(csvParseIntSafe("123")).toBe(123);
      expect(csvParseIntSafe("0")).toBe(0);
    });

    it("should handle commas in numbers", () => {
      expect(csvParseIntSafe("1,234")).toBe(1234);
      expect(csvParseIntSafe("1,234,567")).toBe(1234567);
    });

    it("should return null for empty/invalid values", () => {
      expect(csvParseIntSafe("")).toBeNull();
      expect(csvParseIntSafe(null)).toBeNull();
      expect(csvParseIntSafe(undefined)).toBeNull();
      expect(csvParseIntSafe("-")).toBeNull();
      expect(csvParseIntSafe("abc")).toBeNull();
    });
  });

  describe("csvParseFloatSafe", () => {
    it("should parse valid floats", () => {
      expect(csvParseFloatSafe("12.5")).toBe(12.5);
      expect(csvParseFloatSafe("0.001")).toBe(0.001);
    });

    it("should handle commas", () => {
      expect(csvParseFloatSafe("1,234.56")).toBe(1234.56);
    });

    it("should return null for empty/invalid values", () => {
      expect(csvParseFloatSafe("")).toBeNull();
      expect(csvParseFloatSafe(null)).toBeNull();
      expect(csvParseFloatSafe("-")).toBeNull();
    });
  });

  describe("csvParseDateDDMMYYYY", () => {
    it("should parse DD/MM/YYYY HH:mm:ss format", () => {
      const result = csvParseDateDDMMYYYY("15/01/2025 14:30:00");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getMonth()).toBe(0);
      expect(result!.getDate()).toBe(15);
    });

    it("should parse YYYY-MM-DD HH:mm:ss format", () => {
      const result = csvParseDateDDMMYYYY("2025-01-15 14:30:00");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
    });

    it("should parse YYYY/MM/DD HH:mm:ss format", () => {
      const result = csvParseDateDDMMYYYY("2025/01/15 14:30:00");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
    });

    it("should parse ISO format with T", () => {
      const result = csvParseDateDDMMYYYY("2025-01-15T14:30:00");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
    });

    it("should return null for empty/invalid values", () => {
      expect(csvParseDateDDMMYYYY("")).toBeNull();
      expect(csvParseDateDDMMYYYY(null)).toBeNull();
      expect(csvParseDateDDMMYYYY("-")).toBeNull();
    });
  });

  describe("Full CSV parsing flow", () => {
    it("should parse a complete TikTok CSV row", () => {
      const headerLine = "注文ID,サブ注文ID,注文状況,クリエイターのユーザー名,商品名,SKU,商品ID,価格,数量,ショップ名,ショップコード,コンテンツタイプ,コンテンツID";
      const dataLine = 'ORD001,SUB001,完了,creator1,テスト商品,SKU001,PROD001,"1,500",2,テストショップ,SHOP01,ライブ,CONTENT001';

      const headers = csvParseCSVLine(headerLine);
      const values = csvParseCSVLine(dataLine);
      const row = csvMapHeadersToValues(headers, values);

      expect(row["注文ID"]).toBe("ORD001");
      expect(row["サブ注文ID"]).toBe("SUB001");
      expect(row["商品名"]).toBe("テスト商品");
      expect(csvParseIntSafe(row["価格"])).toBe(1500);
      expect(csvParseIntSafe(row["数量"])).toBe(2);
    });

    it("should handle multi-line CSV with BOM", () => {
      const csvText = "\uFEFF注文ID,サブ注文ID,価格\nORD001,SUB001,1000\nORD002,SUB002,2000";
      const lines = csvText.split("\n").filter(l => l.trim());
      const headers = csvParseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());

      expect(headers).toEqual(["注文ID", "サブ注文ID", "価格"]);
      expect(lines.length).toBe(3);

      const row1 = csvMapHeadersToValues(headers, csvParseCSVLine(lines[1]));
      expect(row1["注文ID"]).toBe("ORD001");
      expect(csvParseIntSafe(row1["価格"])).toBe(1000);

      const row2 = csvMapHeadersToValues(headers, csvParseCSVLine(lines[2]));
      expect(row2["注文ID"]).toBe("ORD002");
      expect(csvParseIntSafe(row2["価格"])).toBe(2000);
    });

    it("should handle large number of rows efficiently", () => {
      const headers = ["ID", "Name", "Value"];
      const rows: string[] = [];
      for (let i = 0; i < 1000; i++) {
        rows.push(`${i},Item${i},${i * 100}`);
      }

      const start = Date.now();
      for (const row of rows) {
        const values = csvParseCSVLine(row);
        csvMapHeadersToValues(headers, values);
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
