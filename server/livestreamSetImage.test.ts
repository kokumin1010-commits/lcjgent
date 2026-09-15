import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  hasCompleteLivestreamSetImageReference,
  LIVESTREAM_SET_IMAGE_MAX_BYTES,
  validateLivestreamSetImage,
} from "../shared/livestreamSetImage";
import { LIVESTREAM_SET_IMAGE_REQUIRED_COLUMNS } from "./livestreamSetImageUpgrade";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("livestream set image validation", () => {
  it("accepts supported images up to 8MB", () => {
    expect(
      validateLivestreamSetImage({
        name: "bag.webp",
        type: "image/webp",
        size: 1024,
      })
    ).toBeNull();
    expect(
      validateLivestreamSetImage({
        name: "bag.jpg",
        type: "image/jpeg",
        size: LIVESTREAM_SET_IMAGE_MAX_BYTES,
      })
    ).toBeNull();
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(
      validateLivestreamSetImage({
        name: "bag.gif",
        type: "image/gif",
        size: 100,
      })
    ).toContain("JPEG");
    expect(
      validateLivestreamSetImage({
        name: "empty.png",
        type: "image/png",
        size: 0,
      })
    ).toContain("空");
    expect(
      validateLivestreamSetImage({
        name: "large.png",
        type: "image/png",
        size: LIVESTREAM_SET_IMAGE_MAX_BYTES + 1,
      })
    ).toContain("8MB");
  });

  it("requires image URL and storage key to be present together", () => {
    expect(hasCompleteLivestreamSetImageReference(null, null)).toBe(true);
    expect(
      hasCompleteLivestreamSetImageReference(
        "https://cdn.example/bag.png",
        "livestreams/7/bag.png"
      )
    ).toBe(true);
    expect(
      hasCompleteLivestreamSetImageReference(
        "https://cdn.example/bag.png",
        null
      )
    ).toBe(false);
    expect(
      hasCompleteLivestreamSetImageReference(null, "livestreams/7/bag.png")
    ).toBe(false);
  });
});

describe("livestream set image integration contract", () => {
  it("adds nullable image columns through the backup-gated startup upgrade", () => {
    expect([...LIVESTREAM_SET_IMAGE_REQUIRED_COLUMNS]).toEqual([
      "imageUrl",
      "imageKey",
    ]);
    const schema = read("drizzle/schema.ts");
    const startup = read("server/_core/index.ts");
    expect(schema).toContain('imageUrl: text("imageUrl")');
    expect(schema).toContain('imageKey: varchar("imageKey", { length: 512 })');
    expect(startup).toContain("runLivestreamSetImageUpgradeSetup");
  });

  it("persists set images on create and protects later replacement with ownership and a transaction", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain(
      "imageUrl: z.string().max(2048).nullable().optional()"
    );
    expect(routers).toContain(
      "imageKey && !imageKey.startsWith(`livestreams/${input.liverId}/`)"
    );
    expect(routers).toContain(
      "requireLivestreamOwnerOrAdmin(ctx, input.livestreamId)"
    );
    expect(routers).toContain("await db.transaction(async tx =>");
    expect(routers).toContain("imageUrl: set.imageUrl?.trim() || null");
  });

  it("imports the platform icon used when entering livestream edit mode", () => {
    const detailPage = read("client/src/pages/LivestreamDetail.tsx");
    const lucideImport =
      detailPage.match(/import\s*\{([\s\S]*?)\}\s*from "lucide-react";/)?.[1] ||
      "";

    expect(detailPage).toContain('<Video className="w-4 h-4" />');
    expect(lucideImport).toMatch(/\bVideo\b/);
  });

  it("supports create-time upload plus later preview, replace, clear and read-only display", () => {
    const createPage = read("client/src/pages/LiverSelfRecord.tsx");
    const detailPage = read("client/src/pages/LivestreamDetail.tsx");
    expect(createPage).toContain("福袋画像（任意）");
    expect(createPage).toContain("setBundleImage(setIndex, file)");
    expect(createPage).toContain(
      'prepareLivestreamImageForUpload(set.imageFile, { prefix: "set" })'
    );
    expect(createPage).toContain("base64: preparedImage.base64");
    expect(createPage).toContain("filename: preparedImage.filename");
    expect(detailPage).toContain("imageUrl: set.imageUrl || null");
    expect(detailPage).toContain("clearBundleImage(setIndex)");
    expect(detailPage).toContain("base64: await fileToBase64(set.imageFile)");
    expect(detailPage).toContain("{set.imageUrl && (");
  });

  it("supports focused clipboard paste for the after screenshot and every bundle image", () => {
    const createPage = read("client/src/pages/LiverSelfRecord.tsx");
    const detailPage = read("client/src/pages/LivestreamDetail.tsx");

    for (const source of [createPage, detailPage]) {
      expect(source).toContain(
        "extractClipboardImageFiles(event.clipboardData)"
      );
      expect(source).toContain(
        'pastedImageFromEvent(event, "after-screenshot")'
      );
      expect(source).toContain("setAfterScreenshot(file, true)");
      expect(source).toContain(
        "pastedImageFromEvent(event, `bundle-${setIndex + 1}`)"
      );
      expect(source).toContain("setBundleImage(setIndex, file)");
      expect(source).toContain("複数の画像が見つかったため、1枚目を使用します");
    }
    expect(createPage).toContain("createClipboardImageFile(files[0], prefix)");
    expect(detailPage).toContain("createClipboardImageFile(file, prefix)");
    expect(detailPage).toContain(
      'aria-label="配信後スクリーンショットを貼り付け"'
    );
    expect(detailPage).toContain(
      "aria-label={`セット ${setIndex + 1} の福袋画像を貼り付け`}"
    );
    expect(createPage).toContain("aria-label={pasteCopy.action}");
    expect(createPage).toContain('"选中这里后按 Ctrl / ⌘ + V 粘贴图片"');
    expect(createPage).toContain(
      "setTimeout(() => handleAnalyzeScreenshot(file), 500)"
    );
  });

  it("keeps file selection and applies the same JPEG/PNG/WebP 8MB validation to pasted images", () => {
    const createPage = read("client/src/pages/LiverSelfRecord.tsx");
    const detailPage = read("client/src/pages/LivestreamDetail.tsx");

    for (const source of [createPage, detailPage]) {
      expect(source).toContain('accept="image/jpeg,image/png,image/webp"');
      expect(source).toContain("onChange={handleScreenshotChange}");
      expect(source).toContain(
        "const validationError = validateLivestreamSetImage(file)"
      );
      expect(source).toContain("current => replaceObjectUrl(current, file)");
      expect(source).toContain("revokeObjectUrl(current)");
    }
    expect(detailPage).toContain(
      "JPEG / PNG / WebP・8MB以下。保存時にアップロードされます。"
    );
    expect(createPage).toContain(
      "JPEG / PNG / WebP・8MB以下。{pasteCopy.savedOnSubmit}"
    );
  });
});
