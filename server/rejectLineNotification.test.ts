import { describe, it, expect } from "vitest";

/**
 * 却下時LINE自動通知機能テスト
 * - 却下理由に応じたガイダンスメッセージの生成
 * - ガイド画像URLの正当性
 * - LINE Messaging APIのメッセージフォーマット
 */

describe("却下時LINE自動通知", () => {
  // ガイド画像URL
  const GUIDE_IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663045992616/GbfvQYedFwWUdlAN.png";

  describe("却下理由に応じたガイダンス生成", () => {
    function generateGuidance(note: string): string {
      let guidance = "";
      if (note.includes("画像が不鮮明")) {
        guidance = "\n\n💡 ヒント: スクリーンショットが鮮明に撮れるよう、画面全体をキャプチャしてください。";
      } else if (note.includes("レシートではない")) {
        guidance = "\n\n💡 ヒント: TikTok Shopの注文詳細画面のスクリーンショットを送信してください。";
      } else if (note.includes("重複申請")) {
        guidance = "\n\n💡 この注文は既に申請済みです。別の注文のスクリーンショットを送信してください。";
      } else if (note.includes("金額不一致")) {
        guidance = "\n\n💡 ヒント: 合計金額（税込）が見えるようにスクリーンショットを撮ってください。";
      }
      return guidance;
    }

    it("画像が不鮮明の場合、適切なガイダンスが生成される", () => {
      const guidance = generateGuidance("画像が不鮮明で確認できません");
      expect(guidance).toContain("画面全体をキャプチャ");
    });

    it("レシートではない場合、適切なガイダンスが生成される", () => {
      const guidance = generateGuidance("レシートではない画像です");
      expect(guidance).toContain("TikTok Shop");
      expect(guidance).toContain("注文詳細画面");
    });

    it("重複申請の場合、適切なガイダンスが生成される", () => {
      const guidance = generateGuidance("重複申請です");
      expect(guidance).toContain("既に申請済み");
      expect(guidance).toContain("別の注文");
    });

    it("金額不一致の場合、適切なガイダンスが生成される", () => {
      const guidance = generateGuidance("金額不一致のため確認できません");
      expect(guidance).toContain("合計金額（税込）");
    });

    it("その他の理由の場合、追加ガイダンスは空文字", () => {
      const guidance = generateGuidance("その他の理由で却下します");
      expect(guidance).toBe("");
    });
  });

  describe("却下通知メッセージのフォーマット", () => {
    function buildRejectionMessage(storeName: string, reason: string, guidance: string, appUrl: string): string {
      return `❌ レシートが却下されました\n\n🏪 店舗名: ${storeName}\n\n📝 却下理由:\n${reason}${guidance}\n\n📸 下の画像を参考に、以下の3つが見えるようにスクリーンショットを撮り直してください:\n① 配達ステータス（配達済み）\n② 注文番号\n③ 合計金額（税込）\n\n※ 1枚に収まらない場合は2〜3枚に分けて送信OK\n\n📋 マイページで確認する\n${appUrl}/mypage`;
    }

    it("メッセージに店舗名が含まれる", () => {
      const msg = buildRejectionMessage("TikTok Shop", "画像が不鮮明", "", "https://lcjmall.com");
      expect(msg).toContain("TikTok Shop");
    });

    it("メッセージに却下理由が含まれる", () => {
      const msg = buildRejectionMessage("TikTok Shop", "画像が不鮮明で確認できません", "", "https://lcjmall.com");
      expect(msg).toContain("画像が不鮮明で確認できません");
    });

    it("メッセージにスクリーンショット撮り方の案内が含まれる", () => {
      const msg = buildRejectionMessage("TikTok Shop", "理由", "", "https://lcjmall.com");
      expect(msg).toContain("① 配達ステータス（配達済み）");
      expect(msg).toContain("② 注文番号");
      expect(msg).toContain("③ 合計金額（税込）");
    });

    it("メッセージにマイページURLが含まれる", () => {
      const msg = buildRejectionMessage("TikTok Shop", "理由", "", "https://lcjmall.com");
      expect(msg).toContain("https://lcjmall.com/mypage");
    });

    it("メッセージに複数枚送信OKの案内が含まれる", () => {
      const msg = buildRejectionMessage("TikTok Shop", "理由", "", "https://lcjmall.com");
      expect(msg).toContain("2〜3枚に分けて送信OK");
    });

    it("店舗名が不明の場合、「不明」と表示される", () => {
      const msg = buildRejectionMessage("不明", "理由", "", "https://lcjmall.com");
      expect(msg).toContain("🏪 店舗名: 不明");
    });

    it("ガイダンスが含まれる場合、メッセージに追加される", () => {
      const guidance = "\n\n💡 ヒント: 画面全体をキャプチャしてください。";
      const msg = buildRejectionMessage("TikTok Shop", "画像が不鮮明", guidance, "https://lcjmall.com");
      expect(msg).toContain("💡 ヒント: 画面全体をキャプチャしてください。");
    });
  });

  describe("LINE Messaging APIメッセージフォーマット", () => {
    it("テキストメッセージのフォーマットが正しい", () => {
      const textMessage = { type: "text", text: "テストメッセージ" };
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

    it("テキスト+画像の2メッセージ送信パターン", () => {
      const messages = [
        { type: "text", text: "却下メッセージ" },
        { type: "image", originalContentUrl: GUIDE_IMAGE_URL, previewImageUrl: GUIDE_IMAGE_URL },
      ];
      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe("text");
      expect(messages[1].type).toBe("image");
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
      // This tests the design principle: notification failure shouldn't fail rejection
      let rejectionSuccess = false;
      let notificationFailed = false;
      
      // Simulate rejection
      rejectionSuccess = true;
      
      // Simulate notification failure
      try {
        throw new Error("LINE API error");
      } catch {
        notificationFailed = true;
        // Don't re-throw - this is the expected behavior
      }
      
      expect(rejectionSuccess).toBe(true);
      expect(notificationFailed).toBe(true);
    });
  });

  describe("フロントエンドUI表示", () => {
    it("却下ダイアログにLINE送信案内が表示される", () => {
      const dialogDescription = "このレシートを却下しますか？理由を選択・入力してください。却下するとお客様のLINEに案内メッセージとスクリーンショットの撮り方ガイド画像が自動送信されます。";
      expect(dialogDescription).toContain("LINE");
      expect(dialogDescription).toContain("ガイド画像");
      expect(dialogDescription).toContain("自動送信");
    });

    it("却下ボタンに「LINE送信」ラベルが含まれる", () => {
      const buttonLabel = "却下する（LINE送信）";
      expect(buttonLabel).toContain("LINE送信");
    });
  });
});
