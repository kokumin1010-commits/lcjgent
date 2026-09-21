import { TRPCError } from "@trpc/server";
import sharp from "sharp";

export const TASK_IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;
export const TASK_IMAGE_LIMIT_PIXELS = 25_000_000;
export const TASK_IMAGE_LIMIT_SIDE = 8_000;

const supportedImageTypes = new Map([
  ["image/jpeg", { ext: "jpg", format: "jpeg" }],
  ["image/png", { ext: "png", format: "png" }],
  ["image/webp", { ext: "webp", format: "webp" }],
]);

export async function decodeValidatedImage(base64: string, mimeType: string) {
  const normalized = base64.replace(/\s/g, "");
  const config = supportedImageTypes.get(mimeType.toLowerCase());
  if (!config || !normalized || normalized.length > Math.ceil(TASK_IMAGE_LIMIT_BYTES * 4 / 3) + 8) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "仅支持5MB以内的JPEG、PNG或WEBP图片" });
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "图片base64格式无效" });
  }
  const input = Buffer.from(normalized, "base64");
  if (!input.length || input.length > TASK_IMAGE_LIMIT_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "图片内容超过5MB" });
  }

  try {
    const decoder = sharp(input, {
      failOn: "error",
      animated: true,
      limitInputPixels: TASK_IMAGE_LIMIT_PIXELS,
    });
    const metadata = await decoder.metadata();
    if (metadata.format !== config.format || !metadata.width || !metadata.height) {
      throw new Error("MIME mismatch");
    }
    if (metadata.width > TASK_IMAGE_LIMIT_SIDE || metadata.height > TASK_IMAGE_LIMIT_SIDE
      || metadata.width * metadata.height > TASK_IMAGE_LIMIT_PIXELS) {
      throw new Error("Image dimensions exceed policy");
    }
    if ((metadata.pages || 1) !== 1) throw new Error("Animated or multi-page image is not allowed");

    const normalizedImage = sharp(input, { failOn: "error", limitInputPixels: TASK_IMAGE_LIMIT_PIXELS }).rotate();
    const buffer = config.format === "jpeg"
      ? await normalizedImage.jpeg({ quality: 90, mozjpeg: true }).toBuffer()
      : config.format === "png"
        ? await normalizedImage.png({ compressionLevel: 9 }).toBuffer()
        : await normalizedImage.webp({ quality: 90 }).toBuffer();
    if (!buffer.length || buffer.length > TASK_IMAGE_LIMIT_BYTES) {
      throw new Error("Normalized image exceeds size policy");
    }
    return { buffer, ext: config.ext, mimeType: mimeType.toLowerCase() };
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "图片无法完整解码、尺寸过大、为动画，或与MIME类型不一致" });
  }
}
