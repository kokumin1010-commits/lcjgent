import { describe, it, expect } from "vitest";

/**
 * 一括納品書印刷機能のテスト
 * - 注文選択のURL生成ロジック
 * - URLパラメータのパース
 * - 選択ロジック
 */

describe("一括納品書印刷: URL生成ロジック", () => {
  it("選択した注文IDからURLパラメータを正しく生成する", () => {
    const selectedIds = new Set([1, 5, 10]);
    const ids = Array.from(selectedIds).join(",");
    const url = `/master/mall/print?ids=${ids}&type=delivery`;
    expect(url).toBe("/master/mall/print?ids=1,5,10&type=delivery");
  });

  it("空の選択セットでは空のIDsパラメータになる", () => {
    const selectedIds = new Set<number>();
    const ids = Array.from(selectedIds).join(",");
    expect(ids).toBe("");
  });

  it("1件だけ選択した場合もカンマなしで正しく生成する", () => {
    const selectedIds = new Set([42]);
    const ids = Array.from(selectedIds).join(",");
    const url = `/master/mall/print?ids=${ids}&type=invoice`;
    expect(url).toBe("/master/mall/print?ids=42&type=invoice");
  });
});

describe("一括納品書印刷: URLパラメータのパース", () => {
  it("カンマ区切りのIDsを正しくパースする", () => {
    const idsStr = "1,5,10";
    const parsed = idsStr
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    expect(parsed).toEqual([1, 5, 10]);
  });

  it("不正な値をフィルタリングする", () => {
    const idsStr = "1,abc,3,,0,-5,10";
    const parsed = idsStr
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    expect(parsed).toEqual([1, 3, 10]);
  });

  it("空文字列の場合は空配列を返す", () => {
    const idsStr = "";
    const parsed = idsStr
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    expect(parsed).toEqual([]);
  });

  it("typeパラメータのデフォルトはdelivery", () => {
    const params = new URLSearchParams("ids=1,2,3");
    const type = params.get("type") || "delivery";
    expect(type).toBe("delivery");
  });

  it("typeパラメータがinvoiceの場合", () => {
    const params = new URLSearchParams("ids=1,2,3&type=invoice");
    const type = params.get("type") || "delivery";
    expect(type).toBe("invoice");
  });

  it("typeパラメータがreceiptの場合", () => {
    const params = new URLSearchParams("ids=1,2,3&type=receipt");
    const type = params.get("type") || "delivery";
    expect(type).toBe("receipt");
  });
});

describe("一括納品書印刷: 選択ロジック", () => {
  it("全選択: 全注文のIDをSetに追加する", () => {
    const orders = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const selectedIds = new Set(orders.map((o) => o.id));
    expect(selectedIds.size).toBe(4);
    expect(selectedIds.has(1)).toBe(true);
    expect(selectedIds.has(4)).toBe(true);
  });

  it("全解除: Setをクリアする", () => {
    const selectedIds = new Set([1, 2, 3]);
    selectedIds.clear();
    expect(selectedIds.size).toBe(0);
  });

  it("個別選択: IDをSetに追加/削除する", () => {
    const selectedIds = new Set<number>();
    
    // 追加
    selectedIds.add(5);
    expect(selectedIds.has(5)).toBe(true);
    expect(selectedIds.size).toBe(1);
    
    // もう1件追加
    selectedIds.add(10);
    expect(selectedIds.size).toBe(2);
    
    // 削除
    selectedIds.delete(5);
    expect(selectedIds.has(5)).toBe(false);
    expect(selectedIds.size).toBe(1);
  });

  it("検索フィルタ後の全選択", () => {
    const orders = [
      { id: 1, name: "田中" },
      { id: 2, name: "佐藤" },
      { id: 3, name: "田中太郎" },
    ];
    const searchQuery = "田中";
    const filtered = orders.filter((o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const selectedIds = new Set(filtered.map((o) => o.id));
    expect(selectedIds.size).toBe(2);
    expect(selectedIds.has(1)).toBe(true);
    expect(selectedIds.has(3)).toBe(true);
    expect(selectedIds.has(2)).toBe(false);
  });
});
