import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${here}/../client/src/pages/ProductManagement.tsx`, "utf8");

describe("MALL product clipboard image paste UI", () => {
  it("routes image clipboard data through the same product media uploader", () => {
    expect(source).toContain('import { extractClipboardImageFiles } from "@shared/clipboardImages"');
    expect(source).toContain("const uploadProductMediaFiles = async (files: File[])");
    expect(source).toContain("const handleProductMediaPaste = (event: React.ClipboardEvent<HTMLElement>)");
    expect(source).toContain("const imageFiles = extractClipboardImageFiles(event.clipboardData)");
    expect(source).toContain("if (imageFiles.length === 0) return");
    expect(source).toContain("void uploadProductMediaFiles(imageFiles)");
    expect(source).toContain("onPaste={handleProductMediaPaste}");
  });

  it("preserves the ten-item and image/video size limits", () => {
    expect(source).toContain("const maxFiles = 10");
    expect(source).toContain("const remainingSlots = maxFiles - currentCount");
    expect(source).toContain('const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024');
    expect(source).toContain("files.slice(0, remainingSlots)");
  });

  it("routes description-area image paste separately and stops bubbling to product media", () => {
    expect(source).toContain("const uploadDescImageFiles = async (files: File[])");
    expect(source).toContain("const handleDescImagePaste = (event: React.ClipboardEvent<HTMLElement>)");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("void uploadDescImageFiles(imageFiles)");
    expect(source).toContain("onPaste={handleDescImagePaste}");
    expect(source).toContain("caption: captionInput || undefined");
  });

  it("shows keyboard paste guidance and focusable upload zones", () => {
    expect(source).toContain('data-testid="product-media-paste-zone"');
    expect(source).toContain('data-testid="product-description-image-paste-zone"');
    expect(source.match(/Ctrl\+V \/ ⌘\+V/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source.match(/tabIndex=\{0\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
