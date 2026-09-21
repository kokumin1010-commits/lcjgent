import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeValidatedImage, TASK_IMAGE_LIMIT_BYTES } from "./uploadValidation";

const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("image upload validation", () => {
  it("fully decodes and re-encodes an allowlisted image", async () => {
    const result = await decodeValidatedImage(onePixelPng, "image/png");
    expect(result).toMatchObject({ ext: "png", mimeType: "image/png" });
    expect(result.buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("rejects unsupported MIME types, forged signatures, and truncated PNG data", async () => {
    await expect(decodeValidatedImage(Buffer.from("hello").toString("base64"), "text/html")).rejects.toThrow();
    await expect(decodeValidatedImage(Buffer.from("not a png").toString("base64"), "image/png")).rejects.toThrow();
    const signatureOnly = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).toString("base64");
    await expect(decodeValidatedImage(signatureOnly, "image/png")).rejects.toThrow(/完整解码/);
  });

  it("rejects payloads larger than five megabytes", async () => {
    const payload = Buffer.alloc(TASK_IMAGE_LIMIT_BYTES + 1, 0xff).toString("base64");
    await expect(decodeValidatedImage(payload, "image/jpeg")).rejects.toThrow(/5MB/);
  });

  it("rejects decodable MIME mismatches and oversized dimensions", async () => {
    await expect(decodeValidatedImage(onePixelPng, "image/jpeg")).rejects.toThrow(/MIME/);
    const tooWide = await sharp({
      create: { width: 8001, height: 1, channels: 3, background: "white" },
    }).png().toBuffer();
    await expect(decodeValidatedImage(tooWide.toString("base64"), "image/png")).rejects.toThrow(/尺寸过大/);
  });
});
