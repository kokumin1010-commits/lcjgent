import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const content = readFileSync(join(__dirname, "lineAgent.ts"), "utf8");
const funcStart = content.indexOf("export async function processReceiptImageMessage");
const funcEnd = content.indexOf("\n}\n\n/**\n * Combined message processor", funcStart);
const funcBody = content.substring(funcStart, funcEnd > funcStart ? funcEnd + 2 : content.length);

describe("LINE receipt image migration handling", () => {
  it("keeps the image handler exported", async () => {
    const mod = await import("./lineAgent");
    expect(typeof mod.processReceiptImageMessage).toBe("function");
  });

  it("does not run OCR, create a receipt, or calculate local points", () => {
    expect(funcBody).not.toContain("processMultipleImagesOcr");
    expect(funcBody).not.toContain("getMessageContent");
    expect(funcBody).not.toContain("createLineReceipt");
    expect(funcBody).not.toContain("pointsCalculated");
  });

  it("never issues a member bearer token or tokenized URL", () => {
    expect(funcBody).not.toContain("createLineMemberSessionToken");
    expect(funcBody).not.toContain("receipt-upload?token=");
    expect(funcBody).not.toContain("sessionToken");
  });

  it("states that new LCJ receipt point applications are stopped", () => {
    expect(funcBody).toContain("新しいLCJレシートポイント申請は停止中です");
    expect(funcBody).toContain("この画像から申請・ポイント付与は行いません");
    expect(funcBody).toContain("${appUrl}/beauty-wallet");
  });

  it("keeps only an auditable historical image entry for staff", () => {
    expect(funcBody).toContain('messageType: "image"');
    expect(funcBody).toContain("LCJポイント申請停止中（履歴保存のみ）");
    expect(funcBody).toContain('responseStatus: "responded"');
  });

  it("still ignores images in group chats", () => {
    expect(funcBody).toContain("isGroupChat");
    expect(funcBody).toContain("Ignoring image in group chat");
  });

  it("does not restore the retired buffering path", () => {
    expect(content).not.toContain("getOrCreatePendingImageSession");
    expect(content).not.toContain("IMAGE_SESSION_TIMEOUT_MS");
    expect(content).not.toContain("processMultipleImagesOcr");
  });
});
