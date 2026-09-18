import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * LINE画像受信時のWebフォーム誘導テスト。
 * LINE画像そのものを申請済みと扱わず、署名済みのWebフォーム導線と
 * 明確な未完了表示を返すことを検証する。
 */

const content = fs.readFileSync(path.join(__dirname, "lineAgent.ts"), "utf-8");
const funcStart = content.indexOf("export async function processReceiptImageMessage");
const funcEnd = content.indexOf("\n}\n\n/**\n * Process multiple images", funcStart);
const funcBody = content.substring(funcStart, funcEnd > funcStart ? funcEnd + 2 : content.length);

describe("LINE Receipt Image → Web Form Redirect", () => {
  it("processReceiptImageMessage function should exist and be exported", async () => {
    const mod = await import("./lineAgent");
    expect(typeof mod.processReceiptImageMessage).toBe("function");
  });

  it("does not run OCR or create a receipt from the LINE image alone", () => {
    expect(funcBody).not.toContain("processMultipleImagesOcr(session");
    expect(funcBody).not.toContain("getMessageContent(messageId)");
    expect(funcBody).not.toContain("createLineReceipt({");
  });

  it("hands the member to the Web form with a signed session token", () => {
    expect(funcBody).toContain("/receipt-upload?token=");
    expect(funcBody).toContain("createLineMemberSessionToken({");
    expect(funcBody).not.toContain("Buffer.from(JSON.stringify(sessionData)).toString('base64')");
  });

  it("states unambiguously that the application is not complete yet", () => {
    expect(funcBody).toContain("ポイント申請はまだ完了していません");
    expect(funcBody).toContain("申請記録は作成されません");
    expect(funcBody).not.toContain("📷 レシート画像を受け取りました！");
  });

  it("keeps an auditable image hand-off in staff message history", () => {
    expect(funcBody).toContain('messageType: "image"');
    expect(funcBody).toContain("LINE送信のみでは申請未完了");
    expect(funcBody).toContain('responseStatus: "responded"');
  });

  it("still ignores images in group chats", () => {
    expect(funcBody).toContain("isGroupChat");
    expect(funcBody).toContain("Ignoring image in group chat");
  });

  it("does not restore the retired image buffering path", () => {
    expect(funcBody).not.toContain("getOrCreatePendingImageSession");
    expect(funcBody).not.toContain("IMAGE_SESSION_TIMEOUT_MS");
    expect(funcBody).not.toContain("session.images.push");
  });

  it("includes the exact steps needed to finish the application", () => {
    expect(funcBody).toContain("申請完了までの手順");
    expect(funcBody).toContain("レシート画像をアップロード");
    expect(funcBody).toContain("申請を受け付けました！");
  });
});
