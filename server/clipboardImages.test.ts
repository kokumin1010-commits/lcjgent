import { describe, expect, it } from "vitest";
import {
  createClipboardImageFile,
  extractClipboardImageFiles,
  type ClipboardDataLike,
  type ClipboardItemLike,
} from "@shared/clipboardImages";

function file(name: string, type: string, size = 4): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: 123 });
}

function item(
  value: File | null,
  kind = "file",
  type = value?.type || ""
): ClipboardItemLike {
  return { kind, type, getAsFile: () => value };
}

describe("extractClipboardImageFiles", () => {
  it("extracts multiple image clipboard items in order", () => {
    const png = file("paste.png", "image/png");
    const jpeg = file("paste.jpg", "image/jpeg");
    const data: ClipboardDataLike = { items: [item(png), item(jpeg)] };
    expect(extractClipboardImageFiles(data)).toEqual([png, jpeg]);
  });

  it("ignores text, html and non-image files", () => {
    const textFile = file("notes.txt", "text/plain");
    const data: ClipboardDataLike = {
      items: [
        item(null, "string", "text/plain"),
        item(null, "string", "text/html"),
        item(textFile),
      ],
    };
    expect(extractClipboardImageFiles(data)).toEqual([]);
  });

  it("falls back to clipboard files when item access is unavailable", () => {
    const png = file("fallback.png", "image/png");
    const textFile = file("fallback.txt", "text/plain");
    expect(extractClipboardImageFiles({ files: [textFile, png] })).toEqual([
      png,
    ]);
  });

  it("prefers clipboard items and removes duplicate image metadata", () => {
    const first = file("same.png", "image/png");
    const duplicate = file("same.png", "image/png");
    const fallback = file("fallback.png", "image/png");
    const data: ClipboardDataLike = {
      items: [item(first), item(duplicate)],
      files: [fallback],
    };
    expect(extractClipboardImageFiles(data)).toEqual([first]);
  });

  it("returns an empty list for absent clipboard data", () => {
    expect(extractClipboardImageFiles(null)).toEqual([]);
    expect(extractClipboardImageFiles(undefined)).toEqual([]);
  });

  it("renames pasted images so the extension always matches the MIME type", async () => {
    const pasted = file("image", "image/png", 8);
    const normalized = createClipboardImageFile(pasted, "bundle-2", 123456);

    expect(normalized).not.toBeNull();
    expect(normalized?.name).toBe("bundle-2-123456.png");
    expect(normalized?.type).toBe("image/png");
    expect(normalized?.size).toBe(pasted.size);
    expect(await normalized?.arrayBuffer()).toEqual(await pasted.arrayBuffer());
  });

  it("sanitizes pasted image prefixes and rejects unsupported formats", () => {
    const jpeg = file("clipboard", "image/jpeg");
    expect(
      createClipboardImageFile(jpeg, " bundle / screenshot ", 77)?.name
    ).toBe("bundle-screenshot-77.jpg");
    expect(
      createClipboardImageFile(file("animation.gif", "image/gif"), "bundle", 77)
    ).toBeNull();
  });
});
