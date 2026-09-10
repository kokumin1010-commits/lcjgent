import { describe, expect, it } from "vitest";
import { extractClipboardImageFiles, type ClipboardDataLike, type ClipboardItemLike } from "@shared/clipboardImages";

function file(name: string, type: string, size = 4): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: 123 });
}

function item(value: File | null, kind = "file", type = value?.type || ""): ClipboardItemLike {
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
    expect(extractClipboardImageFiles({ files: [textFile, png] })).toEqual([png]);
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
});
