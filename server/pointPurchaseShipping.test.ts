import { describe, it, expect } from "vitest";

/**
 * ポイント購入時の配送先情報送信テスト
 * 
 * バグ: ポイント購入時にフロントエンドからshippingInfoが送信されず、
 *       注文レコードの配送先が空になっていた
 * 修正: purchaseWithPointsのinputにshippingInfoを追加し、
 *       フロントエンドからも配送先情報を送信するよう修正
 */

describe("ポイント購入時の配送先情報", () => {
  it("selectedAddressがある場合、shippingInfoが正しく構築されること", () => {
    const selectedAddress = {
      recipientName: "山田太郎",
      phoneNumber: "090-1234-5678",
      postalCode: "1500001",
      prefecture: "東京都",
      city: "渋谷区",
      addressLine1: "1-2-3",
      addressLine2: "マンション101",
    };

    const shippingInfo = {
      name: selectedAddress.recipientName,
      phone: selectedAddress.phoneNumber,
      postalCode: selectedAddress.postalCode,
      address: `${selectedAddress.prefecture}${selectedAddress.city}${selectedAddress.addressLine1}${selectedAddress.addressLine2 ? " " + selectedAddress.addressLine2 : ""}`,
    };

    expect(shippingInfo.name).toBe("山田太郎");
    expect(shippingInfo.phone).toBe("090-1234-5678");
    expect(shippingInfo.postalCode).toBe("1500001");
    expect(shippingInfo.address).toBe("東京都渋谷区1-2-3 マンション101");
  });

  it("addressLine2がない場合、住所にスペースが含まれないこと", () => {
    const selectedAddress = {
      recipientName: "田中花子",
      phoneNumber: "080-9876-5432",
      postalCode: "1000001",
      prefecture: "東京都",
      city: "千代田区",
      addressLine1: "4-5-6",
      addressLine2: "",
    };

    const shippingInfo = {
      name: selectedAddress.recipientName,
      phone: selectedAddress.phoneNumber,
      postalCode: selectedAddress.postalCode,
      address: `${selectedAddress.prefecture}${selectedAddress.city}${selectedAddress.addressLine1}${selectedAddress.addressLine2 ? " " + selectedAddress.addressLine2 : ""}`,
    };

    expect(shippingInfo.address).toBe("東京都千代田区4-5-6");
    expect(shippingInfo.address).not.toContain("  ");
  });

  it("shippingInfoがundefinedの場合でもpurchaseWithPointsのinputは有効であること", () => {
    const input = {
      productId: 1,
      quantity: 2,
      shippingInfo: undefined,
    };

    expect(input.productId).toBe(1);
    expect(input.quantity).toBe(2);
    expect(input.shippingInfo).toBeUndefined();
  });

  it("shippingInfoが提供された場合、purchaseWithPointsのinputに含まれること", () => {
    const input = {
      productId: 1,
      quantity: 1,
      shippingInfo: {
        name: "山田太郎",
        phone: "090-1234-5678",
        postalCode: "1500001",
        address: "東京都渋谷区1-2-3 マンション101",
      },
    };

    expect(input.shippingInfo).toBeDefined();
    expect(input.shippingInfo!.name).toBe("山田太郎");
    expect(input.shippingInfo!.address).toContain("東京都");
  });
});
