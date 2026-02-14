import { describe, it, expect } from "vitest";

/**
 * 重複レシート検出のロジックテスト
 * - 注文番号の抽出ロジック
 * - 重複グルーピングロジック
 * - フロントエンドの重複表示ロジック
 */

// Helper: extract order number from ocrRawText (mirrors db.ts logic)
function extractOrderNumber(ocrRawText: string | null): string | null {
  if (!ocrRawText) return null;
  try {
    const parsed = JSON.parse(ocrRawText);
    return parsed.orderNumber || null;
  } catch {
    const match = ocrRawText.match(/\b(\d{16,19})\b/);
    return match ? match[1] : null;
  }
}

// Helper: detect duplicates from receipts (mirrors db.ts logic)
function detectDuplicates(receipts: { id: number; ocrRawText: string | null }[]) {
  const orderNumberMap = new Map<string, number[]>();
  
  for (const receipt of receipts) {
    const orderNumber = extractOrderNumber(receipt.ocrRawText);
    if (orderNumber) {
      const existing = orderNumberMap.get(orderNumber) || [];
      existing.push(receipt.id);
      orderNumberMap.set(orderNumber, existing);
    }
  }
  
  const duplicates: { orderNumber: string; receiptIds: number[] }[] = [];
  orderNumberMap.forEach((ids, orderNumber) => {
    if (ids.length >= 2) {
      duplicates.push({ orderNumber, receiptIds: ids });
    }
  });
  
  return duplicates;
}

// Helper: build duplicate receipt ID set (mirrors frontend logic)
function buildDuplicateIdSet(duplicateData: { orderNumber: string; receiptIds: number[] }[]) {
  const ids = new Set<number>();
  const orderMap = new Map<string, number[]>();
  for (const dup of duplicateData) {
    orderMap.set(dup.orderNumber, dup.receiptIds);
    for (const id of dup.receiptIds) {
      ids.add(id);
    }
  }
  return { ids, orderMap };
}

describe("注文番号抽出ロジック", () => {
  it("JSON形式のocrRawTextから注文番号を抽出する", () => {
    const result = extractOrderNumber(JSON.stringify({ orderNumber: "5825745729101835" }));
    expect(result).toBe("5825745729101835");
  });

  it("JSON形式でorderNumberがない場合はnullを返す", () => {
    const result = extractOrderNumber(JSON.stringify({ storeName: "Amazon" }));
    expect(result).toBeNull();
  });

  it("非JSON形式のテキストから16-19桁の数字を抽出する", () => {
    const result = extractOrderNumber("注文番号: 5825745729101835 配送済み");
    expect(result).toBe("5825745729101835");
  });

  it("nullの場合はnullを返す", () => {
    expect(extractOrderNumber(null)).toBeNull();
  });

  it("空文字列の場合はnullを返す", () => {
    expect(extractOrderNumber("")).toBeNull();
  });

  it("短い数字は注文番号として認識しない", () => {
    const result = extractOrderNumber("価格: 19999円");
    expect(result).toBeNull();
  });
});

describe("重複レシート検出ロジック", () => {
  it("同じ注文番号のレシートを重複として検出する", () => {
    const receipts = [
      { id: 1, ocrRawText: JSON.stringify({ orderNumber: "5825745729101835" }) },
      { id: 2, ocrRawText: JSON.stringify({ orderNumber: "5825745729101835" }) },
      { id: 3, ocrRawText: JSON.stringify({ orderNumber: "9999999999999999" }) },
    ];
    const duplicates = detectDuplicates(receipts);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].orderNumber).toBe("5825745729101835");
    expect(duplicates[0].receiptIds).toEqual([1, 2]);
  });

  it("重複がない場合は空配列を返す", () => {
    const receipts = [
      { id: 1, ocrRawText: JSON.stringify({ orderNumber: "1111111111111111" }) },
      { id: 2, ocrRawText: JSON.stringify({ orderNumber: "2222222222222222" }) },
    ];
    const duplicates = detectDuplicates(receipts);
    expect(duplicates).toHaveLength(0);
  });

  it("3つ以上の重複も検出する", () => {
    const receipts = [
      { id: 1, ocrRawText: JSON.stringify({ orderNumber: "5825745729101835" }) },
      { id: 2, ocrRawText: JSON.stringify({ orderNumber: "5825745729101835" }) },
      { id: 3, ocrRawText: JSON.stringify({ orderNumber: "5825745729101835" }) },
    ];
    const duplicates = detectDuplicates(receipts);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].receiptIds).toEqual([1, 2, 3]);
  });

  it("ocrRawTextがnullのレシートはスキップする", () => {
    const receipts = [
      { id: 1, ocrRawText: null },
      { id: 2, ocrRawText: JSON.stringify({ orderNumber: "5825745729101835" }) },
    ];
    const duplicates = detectDuplicates(receipts);
    expect(duplicates).toHaveLength(0);
  });

  it("複数の重複グループを検出する", () => {
    const receipts = [
      { id: 1, ocrRawText: JSON.stringify({ orderNumber: "1111111111111111" }) },
      { id: 2, ocrRawText: JSON.stringify({ orderNumber: "1111111111111111" }) },
      { id: 3, ocrRawText: JSON.stringify({ orderNumber: "2222222222222222" }) },
      { id: 4, ocrRawText: JSON.stringify({ orderNumber: "2222222222222222" }) },
    ];
    const duplicates = detectDuplicates(receipts);
    expect(duplicates).toHaveLength(2);
  });
});

describe("フロントエンド重複IDセット構築", () => {
  it("重複データからIDセットを正しく構築する", () => {
    const duplicateData = [
      { orderNumber: "5825745729101835", receiptIds: [1, 2] },
      { orderNumber: "9999999999999999", receiptIds: [3, 4, 5] },
    ];
    const { ids, orderMap } = buildDuplicateIdSet(duplicateData);
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(true);
    expect(ids.has(3)).toBe(true);
    expect(ids.has(4)).toBe(true);
    expect(ids.has(5)).toBe(true);
    expect(ids.has(6)).toBe(false);
    expect(orderMap.get("5825745729101835")).toEqual([1, 2]);
  });

  it("空の重複データの場合は空セットを返す", () => {
    const { ids, orderMap } = buildDuplicateIdSet([]);
    expect(ids.size).toBe(0);
    expect(orderMap.size).toBe(0);
  });

  it("重複IDセットでレシートカードの警告表示を判定できる", () => {
    const duplicateData = [
      { orderNumber: "5825745729101835", receiptIds: [1, 2] },
    ];
    const { ids } = buildDuplicateIdSet(duplicateData);
    
    // Receipt 1 should show warning
    expect(ids.has(1)).toBe(true);
    // Receipt 2 should show warning
    expect(ids.has(2)).toBe(true);
    // Receipt 3 should NOT show warning
    expect(ids.has(3)).toBe(false);
  });
});
