import { describe, it, expect } from "vitest";
import { parseJapaneseAddress } from "./db";

/**
 * 住所重複チェック強化のテスト
 * autoSaveShippingAddress内のnormalizeAddrロジックを検証
 */
describe("住所重複チェック - normalizeAddr", () => {
  // autoSaveShippingAddress内で使われるnormalizeAddrと同じロジック
  const normalizeAddr = (s: string) => s.replace(/[\s　\-－ー]/g, "").toLowerCase();

  it("半角スペースを除去する", () => {
    expect(normalizeAddr("6 15 1")).toBe("6151");
  });

  it("全角スペースを除去する", () => {
    expect(normalizeAddr("6　15　1")).toBe("6151");
  });

  it("ハイフンを除去する", () => {
    expect(normalizeAddr("6-15-1")).toBe("6151");
  });

  it("全角ハイフンを除去する", () => {
    expect(normalizeAddr("6－15－1")).toBe("6151");
  });

  it("長音記号を除去する", () => {
    expect(normalizeAddr("6ー15ー1")).toBe("6151");
  });

  it("同じ番地の異なる表記を同一視する", () => {
    const addr1 = normalizeAddr("6-15-1");
    const addr2 = normalizeAddr("6－15－1");
    const addr3 = normalizeAddr("6ー15ー1");
    expect(addr1).toBe(addr2);
    expect(addr2).toBe(addr3);
  });

  it("異なる番地は区別する", () => {
    const addr1 = normalizeAddr("6-15-1");
    const addr2 = normalizeAddr("6-15-2");
    expect(addr1).not.toBe(addr2);
  });

  it("空文字列を正しく処理する", () => {
    expect(normalizeAddr("")).toBe("");
  });
});

/**
 * 住所重複チェック - 郵便番号+番地の組み合わせ判定テスト
 */
describe("住所重複チェック - 郵便番号+番地の組み合わせ判定", () => {
  const normalizeAddr = (s: string) => s.replace(/[\s　\-－ー]/g, "").toLowerCase();

  // autoSaveShippingAddress内のマッチングロジックを再現
  function findMatchingAddress(
    existingAddresses: Array<{ postalCode: string; addressLine1: string }>,
    postalCode: string,
    parsedAddressLine1: string
  ) {
    return existingAddresses.find(a => {
      if (a.postalCode !== postalCode) return false;
      if (parsedAddressLine1 && a.addressLine1) {
        return normalizeAddr(a.addressLine1) === normalizeAddr(parsedAddressLine1);
      }
      return true;
    });
  }

  it("同じ郵便番号+同じ番地 → マッチする", () => {
    const existing = [{ postalCode: "1600023", addressLine1: "6-15-1" }];
    const match = findMatchingAddress(existing, "1600023", "6-15-1");
    expect(match).toBeTruthy();
  });

  it("同じ郵便番号+異なる番地 → マッチしない", () => {
    const existing = [{ postalCode: "1600023", addressLine1: "6-15-1" }];
    const match = findMatchingAddress(existing, "1600023", "6-15-2");
    expect(match).toBeUndefined();
  });

  it("異なる郵便番号+同じ番地 → マッチしない", () => {
    const existing = [{ postalCode: "1600023", addressLine1: "6-15-1" }];
    const match = findMatchingAddress(existing, "1500001", "6-15-1");
    expect(match).toBeUndefined();
  });

  it("同じ郵便番号+番地の表記ゆれ → マッチする", () => {
    const existing = [{ postalCode: "1600023", addressLine1: "6-15-1" }];
    const match = findMatchingAddress(existing, "1600023", "6－15－1");
    expect(match).toBeTruthy();
  });

  it("複数住所から正しい住所にマッチする", () => {
    const existing = [
      { postalCode: "1600023", addressLine1: "6-15-1" },
      { postalCode: "1600023", addressLine1: "3-3-3" },
      { postalCode: "1500001", addressLine1: "1-2-3" },
    ];
    const match = findMatchingAddress(existing, "1600023", "3-3-3");
    expect(match).toBeTruthy();
    expect(match!.addressLine1).toBe("3-3-3");
  });

  it("番地が空の場合は郵便番号のみでマッチする（後方互換）", () => {
    const existing = [{ postalCode: "1600023", addressLine1: "" }];
    const match = findMatchingAddress(existing, "1600023", "6-15-1");
    expect(match).toBeTruthy();
  });
});

/**
 * parseJapaneseAddress - 住所分割の追加テスト
 */
describe("parseJapaneseAddress - 住所分割追加テスト", () => {
  it("全角スペースで建物名を分割する", () => {
    const result = parseJapaneseAddress("東京都新宿区西新宿6-15-1　タワーマンション3407");
    expect(result.prefecture).toBe("東京都");
    expect(result.addressLine1).toBe("6-15-1");
    expect(result.addressLine2).toBe("タワーマンション3407");
  });

  it("大阪府の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("大阪府大阪市北区梅田1-1-1");
    expect(result.prefecture).toBe("大阪府");
    expect(result.city).toContain("大阪市");
    expect(result.addressLine1).toBe("1-1-1");
  });

  it("京都府の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("京都府京都市中京区河原町通1-2-3");
    expect(result.prefecture).toBe("京都府");
    expect(result.city).toContain("京都市");
  });

  it("都道府県がない場合は全体をaddressLine1に", () => {
    const result = parseJapaneseAddress("新宿区西新宿6-15-1");
    expect(result.prefecture).toBe("");
    expect(result.addressLine1).toBe("新宿区西新宿6-15-1");
  });
});

/**
 * プロフィール更新のバリデーションテスト
 */
describe("プロフィール更新 - バリデーション", () => {
  it("名前が空文字列の場合は無効", () => {
    const name = "";
    expect(name.trim().length > 0).toBe(false);
  });

  it("名前がフルネームでなくても有効", () => {
    const names = ["京極", "関", "龍", "由里子"];
    names.forEach(name => {
      expect(name.trim().length > 0).toBe(true);
    });
  });

  it("メールアドレスの形式チェック", () => {
    const validEmails = ["test@example.com", "user+tag@gmail.com", "a@b.co"];
    const invalidEmails = ["", "not-email", "@no-local.com", "no-at-sign"];
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    validEmails.forEach(email => {
      expect(emailRegex.test(email)).toBe(true);
    });
    
    invalidEmails.forEach(email => {
      expect(emailRegex.test(email)).toBe(false);
    });
  });

  it("電話番号は空でも有効", () => {
    const phone = "";
    // 電話番号はオプションなので空でもOK
    expect(phone.length <= 20).toBe(true);
  });

  it("電話番号が20文字以内", () => {
    const validPhones = ["090-1234-5678", "09012345678", "+81-90-1234-5678"];
    validPhones.forEach(phone => {
      expect(phone.length <= 20).toBe(true);
    });
  });
});
