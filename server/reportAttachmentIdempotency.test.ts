import { describe, expect, it } from "vitest";
import {
  reportAttachmentContentHash,
  reportAttachmentUploadId,
} from "./reportAttachmentIdempotency";

async function browserUploadId(bytes: Uint8Array, label: string): Promise<string> {
  const labelBytes = new TextEncoder().encode(label);
  const input = new Uint8Array(bytes.length + 1 + labelBytes.length);
  input.set(bytes, 0);
  input[bytes.length] = 0;
  input.set(labelBytes, bytes.length + 1);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

describe("daily report attachment idempotency", () => {
  it("matches the browser upload id algorithm exactly", async () => {
    const bytes = new TextEncoder().encode("same validated screenshot bytes");
    await expect(browserUploadId(bytes, "Lark截图"))
      .resolves.toBe(reportAttachmentUploadId(bytes, "Lark截图"));
  });

  it("keeps content identity stable while separating labels", () => {
    const bytes = new TextEncoder().encode("same image");
    expect(reportAttachmentContentHash(bytes)).toMatch(/^[a-f0-9]{64}$/);
    expect(reportAttachmentUploadId(bytes, "LINE截图"))
      .not.toBe(reportAttachmentUploadId(bytes, "Lark截图"));
  });
});
