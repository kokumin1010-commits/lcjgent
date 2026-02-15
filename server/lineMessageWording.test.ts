import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * LINE Webhookメッセージ文言テスト
 * 消費者向けシステムとして適切な文言が使われているか確認
 */
const webhookSource = fs.readFileSync(
  path.join(__dirname, "lineWebhook.ts"),
  "utf-8"
);

describe("LINE Webhook メッセージ文言テスト", () => {
  describe("ウェルカムメッセージ（友だち追加時）", () => {
    it("ライバー向けの案内が含まれていないこと", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleFollowEvent"),
        webhookSource.indexOf("async function handleTextMessage")
      );
      expect(section).not.toContain("LCJライバーアプリにログイン");
      expect(section).not.toContain("プロフィール編集 → LINE連携");
      expect(section).not.toContain("AIコーチングへようこそ");
    });

    it("消費者向けの案内が含まれていること", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleFollowEvent"),
        webhookSource.indexOf("async function handleTextMessage")
      );
      expect(section).toContain("LCJ MALLへようこそ");
      expect(section).toContain("マイページ → LINE連携 → コード発行");
      expect(section).toContain("M-XXXXXX");
    });

    it("Webフォームからの投稿案内が含まれていること", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleFollowEvent"),
        webhookSource.indexOf("async function handleTextMessage")
      );
      expect(section).toContain("Webフォームからレシートを投稿");
      expect(section).toContain("lcjmall.com/receipt-upload");
    });

    it("LINEでのレシート送信案内が含まれていないこと", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleFollowEvent"),
        webhookSource.indexOf("async function handleTextMessage")
      );
      expect(section).not.toContain("レシートをLINEで送信");
      expect(section).not.toContain("レシート画像をこちらに送信");
      expect(section).not.toContain("このトークに送信");
    });
  });

  describe("テキスト入力時の案内メッセージ", () => {
    it("ライバー向けの案内が含まれていないこと", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleTextMessage"),
        webhookSource.indexOf("async function tryLinkMallUser")
      );
      expect(section).not.toContain("LCJライバーの方");
      expect(section).not.toContain("アプリ → プロフィール → LINE連携");
    });

    it("消費者向けの案内が含まれていること", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleTextMessage"),
        webhookSource.indexOf("async function tryLinkMallUser")
      );
      expect(section).toContain("LCJ MALLにログイン");
      expect(section).toContain("マイページ → LINE連携 → コード発行");
    });
  });

  describe("MALL連携完了メッセージ", () => {
    it("LINEでレシート送信の案内が含まれていないこと", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function tryLinkMallUser"),
        webhookSource.indexOf("async function handlePostback")
      );
      expect(section).not.toContain("レシートをLINEで送信");
      expect(section).not.toContain("レシート画像をこちらに送信");
    });

    it("Webフォームからの投稿案内が含まれていること", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function tryLinkMallUser"),
        webhookSource.indexOf("async function handlePostback")
      );
      expect(section).toContain("Webフォームからレシートを投稿");
      expect(section).toContain("lcjmall.com/receipt-upload");
    });

    it("ポイント残高確認の案内が含まれていること", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function tryLinkMallUser"),
        webhookSource.indexOf("async function handlePostback")
      );
      expect(section).toContain("ポイント残高");
    });
  });

  describe("ポイント履歴の空メッセージ", () => {
    it("スクリーンショット送信やTikTok Shopの案内が含まれていないこと", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handlePointHistoryCommand"),
        webhookSource.lastIndexOf("}")
      );
      expect(section).not.toContain("スクリーンショットを送信");
      expect(section).not.toContain("TikTok Shop");
    });

    it("Webフォームからのアップロード案内が含まれていること", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handlePointHistoryCommand"),
        webhookSource.lastIndexOf("}")
      );
      expect(section).toContain("Webフォームからレシートをアップロード");
    });
  });

  describe("画像メッセージ受信時の自動返信", () => {
    it("handleImageMessage関数が存在すること", () => {
      expect(webhookSource).toContain("async function handleImageMessage");
    });

    it("Webフォームへの案内が含まれていること", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleImageMessage"),
        webhookSource.indexOf("async function handlePointHistoryCommand")
      );
      expect(section).toContain("Webフォームからレシートを投稿");
      expect(section).toContain("lcjmall.com/receipt-upload");
    });

    it("LINEでのレシート受付停止の説明が含まれていること", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleImageMessage"),
        webhookSource.indexOf("async function handlePointHistoryCommand")
      );
      expect(section).toContain("LINEでのレシート受付は行っておりません");
    });

    it("メッセージイベントで画像タイプをハンドリングしていること", () => {
      expect(webhookSource).toContain('event.message?.type === "image"');
      expect(webhookSource).toContain("handleImageMessage(event)");
    });
  });

  describe("全体的な文言チェック", () => {
    it("ウェルカムメッセージに過度な絵文字がないこと", () => {
      const section = webhookSource.substring(
        webhookSource.indexOf("async function handleFollowEvent"),
        webhookSource.indexOf("async function handleTextMessage")
      );
      const welcomeMsg = section.substring(
        section.indexOf("LCJ MALLへようこそ"),
        section.indexOf("連携コードを入力してください")
      );
      expect(welcomeMsg).not.toContain("\ud83c\udf8a");
      expect(welcomeMsg).not.toContain("\ud83d\udc47");
    });
  });
});
