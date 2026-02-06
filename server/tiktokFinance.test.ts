import { describe, expect, it, vi, beforeEach } from "vitest";

// Test CSV parsing helper functions
// We need to test the parsing logic independently since the router functions depend on DB

describe("TikTok Finance - CSV Parsing", () => {
  // Re-implement the parsing functions for testing (same as in routers.ts)
  function parseCSVLine(line: string): string[] {
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

  function mapHeadersToValues(headers: string[], values: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < headers.length && i < values.length; i++) {
      result[headers[i]] = values[i];
    }
    return result;
  }

  function parseIntSafe(val: string | undefined | null): number | null {
    if (!val || val === "" || val === "-") return null;
    const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }

  function parseFloatSafe(val: string | undefined | null): number | null {
    if (!val || val === "" || val === "-") return null;
    const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function parseDateDDMMYYYY(val: string | undefined | null): Date | null {
    if (!val || val === "" || val === "-") return null;
    const match = val.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, day, month, year, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }

  describe("parseCSVLine", () => {
    it("parses simple comma-separated values", () => {
      const result = parseCSVLine("a,b,c,d");
      expect(result).toEqual(["a", "b", "c", "d"]);
    });

    it("handles quoted values with commas", () => {
      const result = parseCSVLine('"hello, world",b,c');
      expect(result).toEqual(["hello, world", "b", "c"]);
    });

    it("handles escaped quotes within quoted values", () => {
      const result = parseCSVLine('"he said ""hello""",b');
      expect(result).toEqual(['he said "hello"', "b"]);
    });

    it("handles empty values", () => {
      const result = parseCSVLine("a,,c,");
      expect(result).toEqual(["a", "", "c", ""]);
    });

    it("trims whitespace from values", () => {
      const result = parseCSVLine(" a , b , c ");
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("handles Japanese text", () => {
      const result = parseCSVLine("注文ID,サブ注文ID,商品名");
      expect(result).toEqual(["注文ID", "サブ注文ID", "商品名"]);
    });

    it("handles a realistic CSV header line", () => {
      const result = parseCSVLine("注文ID,サブ注文ID,クリエイターのユーザー名,商品名,SKU,商品ID,価格,数量");
      expect(result).toHaveLength(8);
      expect(result[0]).toBe("注文ID");
      expect(result[6]).toBe("価格");
    });
  });

  describe("mapHeadersToValues", () => {
    it("maps headers to values correctly", () => {
      const headers = ["注文ID", "商品名", "価格"];
      const values = ["12345", "テスト商品", "1000"];
      const result = mapHeadersToValues(headers, values);
      expect(result).toEqual({
        "注文ID": "12345",
        "商品名": "テスト商品",
        "価格": "1000",
      });
    });

    it("handles mismatched lengths (more headers than values)", () => {
      const headers = ["a", "b", "c"];
      const values = ["1", "2"];
      const result = mapHeadersToValues(headers, values);
      expect(result).toEqual({ a: "1", b: "2" });
    });

    it("handles mismatched lengths (more values than headers)", () => {
      const headers = ["a", "b"];
      const values = ["1", "2", "3"];
      const result = mapHeadersToValues(headers, values);
      expect(result).toEqual({ a: "1", b: "2" });
    });
  });

  describe("parseIntSafe", () => {
    it("parses normal integers", () => {
      expect(parseIntSafe("1000")).toBe(1000);
    });

    it("parses integers with commas", () => {
      expect(parseIntSafe("1,000,000")).toBe(1000000);
    });

    it("returns null for empty string", () => {
      expect(parseIntSafe("")).toBeNull();
    });

    it("returns null for dash", () => {
      expect(parseIntSafe("-")).toBeNull();
    });

    it("returns null for null/undefined", () => {
      expect(parseIntSafe(null)).toBeNull();
      expect(parseIntSafe(undefined)).toBeNull();
    });

    it("handles whitespace", () => {
      expect(parseIntSafe(" 500 ")).toBe(500);
    });

    it("returns null for non-numeric strings", () => {
      expect(parseIntSafe("abc")).toBeNull();
    });
  });

  describe("parseFloatSafe", () => {
    it("parses decimal numbers", () => {
      expect(parseFloatSafe("10.5")).toBe(10.5);
    });

    it("parses numbers with commas", () => {
      expect(parseFloatSafe("1,234.56")).toBe(1234.56);
    });

    it("returns null for empty string", () => {
      expect(parseFloatSafe("")).toBeNull();
    });

    it("returns null for dash", () => {
      expect(parseFloatSafe("-")).toBeNull();
    });

    it("parses percentage-like values", () => {
      expect(parseFloatSafe("15.0")).toBe(15.0);
    });
  });

  describe("parseDateDDMMYYYY", () => {
    it("parses DD/MM/YYYY HH:mm:ss format", () => {
      const result = parseDateDDMMYYYY("15/01/2026 10:30:45");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(0); // January = 0
      expect(result!.getDate()).toBe(15);
      expect(result!.getHours()).toBe(10);
      expect(result!.getMinutes()).toBe(30);
      expect(result!.getSeconds()).toBe(45);
    });

    it("parses another date correctly", () => {
      const result = parseDateDDMMYYYY("01/10/2025 00:00:00");
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getMonth()).toBe(9); // October = 9
      expect(result!.getDate()).toBe(1);
    });

    it("returns null for empty string", () => {
      expect(parseDateDDMMYYYY("")).toBeNull();
    });

    it("returns null for dash", () => {
      expect(parseDateDDMMYYYY("-")).toBeNull();
    });

    it("returns null for invalid format", () => {
      expect(parseDateDDMMYYYY("2025-01-15")).toBeNull();
    });

    it("returns null for null/undefined", () => {
      expect(parseDateDDMMYYYY(null)).toBeNull();
      expect(parseDateDDMMYYYY(undefined)).toBeNull();
    });
  });
});

describe("TikTok Finance - Data Validation", () => {
  it("validates that a realistic CSV row can be parsed", () => {
    // Simulate a realistic CSV line from the actual data
    const header = "注文ID,サブ注文ID,クリエイターのユーザー名,商品名,SKU,商品ID,価格,数量,ショップ名,ショップコード,注文状況,コンテンツタイプ,コンテンツID";
    const row = "ORD001,SUB001,ryukyogoku,テスト商品,SKU-A,PROD001,3500,1,KYOGOKU JAPAN,JP001,完了,LIVE,CONTENT001";

    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
          if (char === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
          } else { current += char; }
        } else {
          if (char === '"') { inQuotes = true; } else if (char === ',') { result.push(current.trim()); current = ""; } else { current += char; }
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseCSVLine(header);
    const values = parseCSVLine(row);
    
    expect(headers).toHaveLength(13);
    expect(values).toHaveLength(13);

    const mapped: Record<string, string> = {};
    for (let i = 0; i < headers.length && i < values.length; i++) {
      mapped[headers[i]] = values[i];
    }

    expect(mapped["注文ID"]).toBe("ORD001");
    expect(mapped["サブ注文ID"]).toBe("SUB001");
    expect(mapped["クリエイターのユーザー名"]).toBe("ryukyogoku");
    expect(mapped["商品名"]).toBe("テスト商品");
    expect(mapped["価格"]).toBe("3500");
    expect(mapped["数量"]).toBe("1");
    expect(mapped["ショップ名"]).toBe("KYOGOKU JAPAN");
    expect(mapped["注文状況"]).toBe("完了");
    expect(mapped["コンテンツタイプ"]).toBe("LIVE");
  });

  it("handles CSV rows with quoted fields containing commas", () => {
    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
          if (char === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
          } else { current += char; }
        } else {
          if (char === '"') { inQuotes = true; } else if (char === ',') { result.push(current.trim()); current = ""; } else { current += char; }
        }
      }
      result.push(current.trim());
      return result;
    }

    const line = 'ORD001,SUB001,"商品名, 特別版",3500';
    const result = parseCSVLine(line);
    expect(result).toEqual(["ORD001", "SUB001", "商品名, 特別版", "3500"]);
  });
});

describe("TikTok Finance - formatCurrency", () => {
  function formatCurrency(val: number | string | null | undefined): string {
    const num = typeof val === 'string' ? parseFloat(val) : (val || 0);
    return `¥${Math.round(num).toLocaleString()}`;
  }

  it("formats number correctly", () => {
    expect(formatCurrency(30314068)).toBe("¥30,314,068");
  });

  it("formats string number correctly", () => {
    expect(formatCurrency("3653913.45")).toBe("¥3,653,913");
  });

  it("handles null", () => {
    expect(formatCurrency(null)).toBe("¥0");
  });

  it("handles undefined", () => {
    expect(formatCurrency(undefined)).toBe("¥0");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("¥0");
  });
});
