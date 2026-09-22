import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${here}/../client/src/pages/ProductManagement.tsx`, "utf8");

describe("MALL product clipboard image paste UI", () => {
  it("routes image clipboard data through the same product media uploader", () => {
    expect(source).toContain('from "@shared/clipboardImages"');
    expect(source).toContain("extractClipboardImageFiles,");
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

  it("uses the same validated uploader for new and existing variant image paste", () => {
    expect(source).toContain("createClipboardImageFile,");
    expect(source).toContain("const uploadVariantImageFile = async (file: File)");
    expect(source).toContain('file.type.toLowerCase().startsWith("image/")');
    expect(source).toContain("file.size > 5 * 1024 * 1024");
    expect(source).toContain("const handleNewVariantImageUpload = async (file: File)");
    expect(source).toContain("const handleVariantImagePaste = (");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("const clipboardFile = createClipboardImageFile(");
    expect(source).toContain("void handleNewVariantImageUpload(clipboardFile)");
    expect(source).toContain("void handleVariantImageUpload(variantId, clipboardFile)");
    expect(source).toContain("await updateVariant.mutateAsync({");
  });

  it("keeps variant uploads and creation serialized until persistence finishes", () => {
    expect(source).toContain("const newVariantCreateInFlightRef = useRef(false)");
    expect(source).toContain("const handleAddVariant = async () =>");
    expect(source).toContain("variantImageUploadInFlightRef.current || newVariantCreateInFlightRef.current");
    expect(source).toContain("newVariantCreateInFlightRef.current = true");
    expect(source).toContain("await createVariant.mutateAsync({");
    expect(source).toContain("newVariantCreateInFlightRef.current = false");
    expect(source).toContain("disabled={createVariant.isPending || newVariantUploading || uploadingVariantId !== null}");
  });

  it("exposes focusable paste targets for new and existing variant images", () => {
    expect(source).toContain('data-testid={`variant-image-paste-zone-${v.id}`}');
    expect(source).toContain('data-testid="new-variant-image-paste-zone"');
    expect(source).toContain("onPaste={(event) => handleVariantImagePaste(event, v.id)}");
    expect(source).toContain("onPaste={(event) => handleVariantImagePaste(event)}");
    expect(source).toContain("event.currentTarget.parentElement?.focus()");
    expect(source).toContain("Ctrl/⌘+V 貼付");
    expect(source).toContain("画像欄を選択し、Ctrl+V / ⌘+V");
  });

  it("shows keyboard paste guidance and focusable upload zones", () => {
    expect(source).toContain('data-testid="product-media-paste-zone"');
    expect(source).toContain('data-testid="product-description-image-paste-zone"');
    expect(source.match(/Ctrl\+V \/ ⌘\+V/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source.match(/tabIndex=\{0\}/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
