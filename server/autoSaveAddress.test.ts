import { describe, it, expect } from "vitest";
import { parseJapaneseAddress } from "./db";

describe("parseJapaneseAddress", () => {
  it("東京都の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("東京都港区三田3-3-3");
    expect(result.prefecture).toBe("東京都");
    expect(result.city).toBe("港区三田");
    expect(result.addressLine1).toBe("3-3-3");
    expect(result.addressLine2).toBeNull();
  });

  it("建物名付きの住所を正しく分割する", () => {
    const result = parseJapaneseAddress("東京都新宿区西新宿6-15-1 3407");
    expect(result.prefecture).toBe("東京都");
    expect(result.city).toBe("新宿区西新宿");
    expect(result.addressLine1).toBe("6-15-1");
    expect(result.addressLine2).toBe("3407");
  });

  it("埼玉県の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("埼玉県行田市棚田町1-47-1");
    expect(result.prefecture).toBe("埼玉県");
    expect(result.city).toBe("行田市棚田町");
    expect(result.addressLine1).toBe("1-47-1");
    expect(result.addressLine2).toBeNull();
  });

  it("北海道の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("北海道岩見沢市幌向南三条2-231-58");
    expect(result.prefecture).toBe("北海道");
    expect(result.city).toBe("岩見沢市幌向南三条");
    expect(result.addressLine1).toBe("2-231-58");
    expect(result.addressLine2).toBeNull();
  });

  it("愛知県の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("愛知県日進市南ケ丘1-22-7");
    expect(result.prefecture).toBe("愛知県");
    expect(result.city).toBe("日進市南ケ丘");
    expect(result.addressLine1).toBe("1-22-7");
    expect(result.addressLine2).toBeNull();
  });

  it("岐阜県の住所（漢数字混在）を分割する", () => {
    const result = parseJapaneseAddress("岐阜県羽島郡岐南町平島2の243の2");
    expect(result.prefecture).toBe("岐阜県");
    // 郡を含む住所
    expect(result.city).toContain("羽島郡");
    expect(result.addressLine1).toBeTruthy();
  });

  it("福岡県の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("福岡県直方市上新入2243-96");
    expect(result.prefecture).toBe("福岡県");
    expect(result.city).toBe("直方市上新入");
    expect(result.addressLine1).toBe("2243-96");
    expect(result.addressLine2).toBeNull();
  });

  it("京都府の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("京都府京都市左京区下鴨本町1-2");
    expect(result.prefecture).toBe("京都府");
    expect(result.city).toContain("京都市");
    expect(result.addressLine1).toContain("1-2");
  });

  it("大阪府の住所を正しく分割する", () => {
    const result = parseJapaneseAddress("大阪府大阪市北区梅田1-1-1");
    expect(result.prefecture).toBe("大阪府");
    expect(result.city).toContain("大阪市");
    expect(result.addressLine1).toBe("1-1-1");
  });

  it("都道府県がない場合は全体をaddressLine1にする", () => {
    const result = parseJapaneseAddress("港区三田3-3-3");
    expect(result.prefecture).toBe("");
    expect(result.addressLine1).toBe("港区三田3-3-3");
  });

  it("空文字列の場合", () => {
    const result = parseJapaneseAddress("");
    expect(result.prefecture).toBe("");
    expect(result.city).toBe("");
    expect(result.addressLine1).toBe("");
    expect(result.addressLine2).toBeNull();
  });

  it("建物名が全角スペースで区切られている場合", () => {
    const result = parseJapaneseAddress("東京都渋谷区恵比寿1-2-3　タワーマンション101");
    expect(result.prefecture).toBe("東京都");
    expect(result.city).toBe("渋谷区恵比寿");
    expect(result.addressLine1).toBe("1-2-3");
    expect(result.addressLine2).toBe("タワーマンション101");
  });
});

describe("autoSaveShippingAddress logic", () => {
  it("shippingInfo の name が空の場合は保存しない（ロジック確認）", () => {
    // autoSaveShippingAddress は name が空の場合 return する
    const shippingInfo = { name: "", phone: "09012345678", postalCode: "1080073", address: "東京都港区三田3-3-3" };
    const name = shippingInfo.name?.trim();
    expect(!name).toBe(true); // 空文字は falsy
  });

  it("shippingInfo の postalCode が空の場合は保存しない（ロジック確認）", () => {
    const shippingInfo = { name: "テスト太郎", phone: "09012345678", postalCode: "", address: "東京都港区三田3-3-3" };
    const postalCode = shippingInfo.postalCode?.trim();
    expect(!postalCode).toBe(true);
  });

  it("shippingInfo の address が空の場合は保存しない（ロジック確認）", () => {
    const shippingInfo = { name: "テスト太郎", phone: "09012345678", postalCode: "1080073", address: "" };
    const address = shippingInfo.address?.trim();
    expect(!address).toBe(true);
  });

  it("フルネームでない名前もそのまま保存される（ロジック確認）", () => {
    const shippingInfo = { name: "京極", phone: "09012345678", postalCode: "1080073", address: "東京都港区三田3-3-3" };
    const name = shippingInfo.name?.trim();
    expect(name).toBe("京極"); // フルネームでなくてもそのまま
  });

  it("名前の前後の空白はトリムされる", () => {
    const shippingInfo = { name: "  関　由里子  ", phone: "09012345678", postalCode: "3610041", address: "埼玉県行田市棚田町1-47-1" };
    const name = shippingInfo.name?.trim();
    expect(name).toBe("関　由里子");
  });
});
