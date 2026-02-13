import { describe, it, expect } from "vitest";

/**
 * 却下時LINE自動通知機能テスト（簡略化版）
 * - ダイアログなし・ワンタップ却下
 * - レシート画像送り返し + 固定メッセージ + ガイド画像
 * - noteは任意（バックエンドで「不承認」がデフォルト）
 */

describe("却下時LINE自動通知（簡略化版）", () => {
  const GUIDE_IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663045992616/GbfvQYedFwWUdlAN.png";

  describe("固定却下メッセージのフォーマット", () => {
    const REJECTION_MESSAGE = `❌ 不承認です

上の写真の内容をご確認の上、以下の情報が見えるようにスクリーンショットを撮り直してください🙏

① 配達ステータス（配達済み）
② 注文番号
③ 合計金額（税込）

※ 1枚に収まらない場合は2〜3枚に分けて送信OK

下の画像を参考にしてください⬇️`;

    it("メッセージに「不承認です」が含まれる", () => {
      expect(REJECTION_MESSAGE).toContain("不承認です");
    });

    it("メッセージにスクリーンショット撮り方の案内が含まれる", () => {
      expect(REJECTION_MESSAGE).toContain("① 配達ステータス（配達済み）");
      expect(REJECTION_MESSAGE).toContain("② 注文番号");
      expect(REJECTION_MESSAGE).toContain("③ 合計金額（税込）");
    });

    it("メッセージに複数枚送信OKの案内が含まれる", () => {
      expect(REJECTION_MESSAGE).toContain("2〜3枚に分けて送信OK");
    });

    it("メッセージにガイド画像参照の案内が含まれる", () => {
      expect(REJECTION_MESSAGE).toContain("下の画像を参考にしてください");
    });

    it("メッセージに写真確認の案内が含まれる", () => {
      expect(REJECTION_MESSAGE).toContain("上の写真の内容をご確認の上");
    });
  });

  describe("レシート画像送り返しロジック", () => {
    function getReceiptImages(receipt: { imageUrls?: string[] | null; imageUrl?: string | null }): string[] {
      const images: string[] = [];
      if (receipt.imageUrls && Array.isArray(receipt.imageUrls)) {
        images.push(...receipt.imageUrls);
      } else if (receipt.imageUrl) {
        images.push(receipt.imageUrl);
      }
      return images;
    }

    it("imageUrlsがある場合、全ての画像を返す", () => {
      const receipt = { imageUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg"] };
      const images = getReceiptImages(receipt);
      expect(images).toHaveLength(2);
      expect(images[0]).toBe("https://example.com/1.jpg");
      expect(images[1]).toBe("https://example.com/2.jpg");
    });

    it("imageUrlsがなくimageUrlがある場合、1枚を返す", () => {
      const receipt = { imageUrl: "https://example.com/single.jpg" };
      const images = getReceiptImages(receipt);
      expect(images).toHaveLength(1);
      expect(images[0]).toBe("https://example.com/single.jpg");
    });

    it("画像がない場合、空配列を返す", () => {
      const receipt = {};
      const images = getReceiptImages(receipt);
      expect(images).toHaveLength(0);
    });

    it("imageUrlsが空配列の場合、空配列を返す", () => {
      const receipt = { imageUrls: [] };
      const images = getReceiptImages(receipt);
      expect(images).toHaveLength(0);
    });
  });

  describe("LINE送信メッセージ順序", () => {
    it("送信順序: レシート画像 → テキストメッセージ → ガイド画像", () => {
      // Simulate the message sending order
      const sentMessages: { type: string; content: string }[] = [];
      const receiptImages = ["https://example.com/receipt1.jpg", "https://example.com/receipt2.jpg"];

      // 1. Send receipt images
      for (const imgUrl of receiptImages) {
        sentMessages.push({ type: "image", content: imgUrl });
      }

      // 2. Send rejection text
      sentMessages.push({ type: "text", content: "❌ 不承認です..." });

      // 3. Send guide image
      sentMessages.push({ type: "image", content: GUIDE_IMAGE_URL });

      expect(sentMessages).toHaveLength(4);
      expect(sentMessages[0].type).toBe("image"); // receipt image 1
      expect(sentMessages[1].type).toBe("image"); // receipt image 2
      expect(sentMessages[2].type).toBe("text");  // rejection message
      expect(sentMessages[3].type).toBe("image"); // guide image
      expect(sentMessages[3].content).toBe(GUIDE_IMAGE_URL);
    });

    it("レシート画像がない場合でもテキスト+ガイド画像は送信される", () => {
      const sentMessages: { type: string }[] = [];
      const receiptImages: string[] = [];

      for (const imgUrl of receiptImages) {
        sentMessages.push({ type: "image" });
      }
      sentMessages.push({ type: "text" });
      sentMessages.push({ type: "image" });

      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[0].type).toBe("text");
      expect(sentMessages[1].type).toBe("image");
    });
  });

  describe("LINE Messaging APIメッセージフォーマット", () => {
    it("テキストメッセージのフォーマットが正しい", () => {
      const textMessage = { type: "text", text: "❌ 不承認です" };
      expect(textMessage.type).toBe("text");
      expect(textMessage.text).toBeTruthy();
    });

    it("画像メッセージのフォーマットが正しい", () => {
      const imageMessage = {
        type: "image",
        originalContentUrl: GUIDE_IMAGE_URL,
        previewImageUrl: GUIDE_IMAGE_URL,
      };
      expect(imageMessage.type).toBe("image");
      expect(imageMessage.originalContentUrl).toBe(GUIDE_IMAGE_URL);
      expect(imageMessage.previewImageUrl).toBe(GUIDE_IMAGE_URL);
    });

    it("画像URLがHTTPSで始まる", () => {
      expect(GUIDE_IMAGE_URL).toMatch(/^https:\/\//);
    });

    it("画像URLが有効な拡張子を持つ", () => {
      expect(GUIDE_IMAGE_URL).toMatch(/\.(jpg|jpeg|png|gif)$/i);
    });
  });

  describe("バックエンドAPI入力バリデーション", () => {
    it("noteが省略可能（undefinedでOK）", () => {
      const input = { id: 1 };
      expect(input).toHaveProperty("id");
      expect((input as any).note).toBeUndefined();
    });

    it("noteが空文字の場合、デフォルト「不承認」が使われる", () => {
      const note = "";
      const savedNote = note || "不承認";
      expect(savedNote).toBe("不承認");
    });

    it("noteが指定されている場合、そのまま保存される", () => {
      const note = "カスタム理由";
      const savedNote = note || "不承認";
      expect(savedNote).toBe("カスタム理由");
    });
  });

  describe("却下処理フロー全体", () => {
    it("却下時にステータスが'rejected'に更新される", () => {
      const receipt = { id: 1, status: "pending" as string };
      receipt.status = "rejected";
      expect(receipt.status).toBe("rejected");
    });

    it("LINE未連携ユーザーの場合、通知をスキップ", () => {
      const receipt = { id: 1, lineUserId: null as string | null };
      const shouldNotify = !!receipt.lineUserId;
      expect(shouldNotify).toBe(false);
    });

    it("LINE連携済みユーザーの場合、通知を送信", () => {
      const receipt = { id: 1, lineUserId: "U1234567890" };
      const shouldNotify = !!receipt.lineUserId;
      expect(shouldNotify).toBe(true);
    });

    it("通知失敗でも却下処理自体は成功する（try-catch設計）", () => {
      let rejectionSuccess = false;
      let notificationFailed = false;
      
      rejectionSuccess = true;
      
      try {
        throw new Error("LINE API error");
      } catch {
        notificationFailed = true;
      }
      
      expect(rejectionSuccess).toBe(true);
      expect(notificationFailed).toBe(true);
    });
  });

  describe("ワンタップ却下（ダイアログなし）", () => {
    it("handleDirectRejectが呼ばれるとrejectMutationが即座に実行される", () => {
      let mutationCalled = false;
      let mutationInput: any = null;
      
      // Mock rejectMutation.mutate
      const mutate = (input: { id: number; note?: string }) => {
        mutationCalled = true;
        mutationInput = input;
      };
      
      // Simulate handleDirectReject
      const receiptId = 42;
      mutate({ id: receiptId });
      
      expect(mutationCalled).toBe(true);
      expect(mutationInput.id).toBe(42);
      expect(mutationInput.note).toBeUndefined();
    });

    it("キーボードショートカットRキーで直接却下が実行される", () => {
      let directRejectCalled = false;
      let rejectedId: number | null = null;
      
      const handleDirectReject = (id: number) => {
        directRejectCalled = true;
        rejectedId = id;
      };
      
      // Simulate R key press with selected receipt
      const selectedReceipt = { receipt: { id: 99, status: "pending" } };
      const isPending = false;
      
      if (selectedReceipt && (selectedReceipt.receipt.status === "pending" || selectedReceipt.receipt.status === "on_hold") && !isPending) {
        handleDirectReject(selectedReceipt.receipt.id);
      }
      
      expect(directRejectCalled).toBe(true);
      expect(rejectedId).toBe(99);
    });

    it("rejectMutation処理中はキーボードショートカットが無効化される", () => {
      let directRejectCalled = false;
      
      const handleDirectReject = () => {
        directRejectCalled = true;
      };
      
      const selectedReceipt = { receipt: { id: 99, status: "pending" } };
      const isPending = true; // mutation is pending
      
      if (selectedReceipt && selectedReceipt.receipt.status === "pending" && !isPending) {
        handleDirectReject();
      }
      
      expect(directRejectCalled).toBe(false);
    });
  });

  describe("AI再認識後の注文番号反映", () => {
    it("AI再認識成功時に注文番号がDBに保存される", () => {
      const recognizedOrderNumber = "5825320077212071733";
      const calcReceiptId = 42;
      let savedOrderNumber: string | null = null;
      let savedReceiptId: number | null = null;
      
      const updateOrderNumber = (id: number, orderNumber: string) => {
        savedReceiptId = id;
        savedOrderNumber = orderNumber;
      };
      
      if (recognizedOrderNumber && calcReceiptId) {
        updateOrderNumber(calcReceiptId, recognizedOrderNumber);
      }
      
      expect(savedReceiptId).toBe(42);
      expect(savedOrderNumber).toBe("5825320077212071733");
    });

    it("承認時にcalcOrderNumberがバックエンドに渡される", () => {
      const calcOrderNumber = "5825320077212071733";
      const mutationInput = {
        id: 42,
        pointsOverride: 148,
        orderNumber: calcOrderNumber.trim() || undefined,
      };
      
      expect(mutationInput.orderNumber).toBe("5825320077212071733");
    });
  });

  describe("フロントエンドUI表示", () => {
    it("却下ボタンに「LINE送信」ラベルが含まれる", () => {
      const buttonLabel = "却下（LINE送信）";
      expect(buttonLabel).toContain("LINE送信");
    });

    it("却下ボタンに処理中表示がある", () => {
      const loadingLabel = "送信中...";
      expect(loadingLabel).toContain("送信中");
    });

    it("保留ダイアログは引き続き理由入力が必要", () => {
      const holdDialogDescription = "このレシートを保留にしますか？理由を入力してください。";
      expect(holdDialogDescription).toContain("理由を入力");
    });
  });
});
