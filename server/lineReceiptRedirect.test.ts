import { describe, it, expect } from "vitest";

/**
 * LINE画像受信時のWebフォーム誘導テスト
 * processReceiptImageMessage関数がLINE画像解析を廃止し、
 * Webフォームリンクのみ案内するように変更されたことを検証
 */

describe("LINE Receipt Image → Web Form Redirect", () => {
  it("processReceiptImageMessage function should exist and be exported", async () => {
    const mod = await import("./lineAgent");
    expect(typeof mod.processReceiptImageMessage).toBe("function");
  });

  it("should not process images (no OCR call) - function signature check", async () => {
    // The function should exist but no longer call processMultipleImagesOcr
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(__dirname, "lineAgent.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    // Find the processReceiptImageMessage function body
    const funcStart = content.indexOf("export async function processReceiptImageMessage");
    const funcBody = content.substring(funcStart, funcStart + 3000);
    
    // Should NOT contain processMultipleImagesOcr call
    expect(funcBody).not.toContain("processMultipleImagesOcr(session");
    // Should NOT contain getMessageContent (no longer fetching image data)
    expect(funcBody).not.toContain("getMessageContent(messageId)");
    // Should NOT contain createLineReceipt (no longer creating receipt records from LINE)
    expect(funcBody).not.toContain("createLineReceipt({");
  });

  it("should contain Web form URL in the response message", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(__dirname, "lineAgent.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    const funcStart = content.indexOf("export async function processReceiptImageMessage");
    const funcBody = content.substring(funcStart, funcStart + 3000);
    
    // Should contain receipt-upload URL
    expect(funcBody).toContain("/receipt-upload");
    // Should contain Web form guidance
    expect(funcBody).toContain("Webフォーム");
  });

  it("should mention that LINE image analysis is discontinued", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(__dirname, "lineAgent.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    const funcStart = content.indexOf("export async function processReceiptImageMessage");
    const funcBody = content.substring(funcStart, funcStart + 3000);
    
    // Should inform user that LINE image analysis is discontinued
    expect(funcBody).toContain("廃止");
  });

  it("should still ignore images in group chats", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(__dirname, "lineAgent.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    const funcStart = content.indexOf("export async function processReceiptImageMessage");
    const funcBody = content.substring(funcStart, funcStart + 3000);
    
    // Should still check for group chats and ignore
    expect(funcBody).toContain("isGroupChat");
    expect(funcBody).toContain("Ignoring image in group chat");
  });

  it("should not have image buffering/session logic", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(__dirname, "lineAgent.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    const funcStart = content.indexOf("export async function processReceiptImageMessage");
    const funcBody = content.substring(funcStart, funcStart + 3000);
    
    // Should NOT contain session/buffering logic
    expect(funcBody).not.toContain("getOrCreatePendingImageSession");
    expect(funcBody).not.toContain("IMAGE_SESSION_TIMEOUT_MS");
    expect(funcBody).not.toContain("session.images.push");
  });

  it("should include step-by-step instructions for users", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(__dirname, "lineAgent.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    
    const funcStart = content.indexOf("export async function processReceiptImageMessage");
    const funcBody = content.substring(funcStart, funcStart + 3000);
    
    // Should contain step-by-step instructions
    expect(funcBody).toContain("手順");
    expect(funcBody).toContain("アップロード");
  });
});
