import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../client/src/pages/InfluencerBd.tsx", import.meta.url),
  "utf8",
);
const pickerSource = readFileSync(
  new URL(
    "../client/src/components/influencer/InfluencerImagePastePicker.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("influencer BD clipboard image paste UI", () => {
  it("routes every influencer image picker through the shared paste component", () => {
    expect(pageSource.match(/pasteFilePrefix="influencer-profile"/g)).toHaveLength(2);
    expect(pageSource.match(/pasteFilePrefix="influencer-chat"/g)).toHaveLength(1);
    expect(pageSource).toContain('L("选择 / Ctrl+V识别", "選択 / Ctrl+V認識")');
    expect(pageSource).toContain("Ctrl / ⌘ + V");
    expect(pageSource).not.toContain('<label className={`inline-flex h-10 cursor-pointer');
    expect(pageSource).not.toContain('onChange={e => setPendingFiles(Array.from(e.target.files || []).slice(0, 10))}');
  });

  it("keeps the client limits aligned with the existing server upload contracts", () => {
    expect(pageSource).toContain("const CREATOR_IMPORT_MAX_BYTES = 5 * 1024 * 1024");
    expect(pageSource).toContain("const CHAT_SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024");
    expect(pageSource).toContain("const CHAT_SCREENSHOT_MAX_FILES = 10");
    expect(pageSource).toContain("currentFileCount={pendingFiles.length}");
    expect(pageSource).toContain("imagesOnly maxFileBytes={CHAT_SCREENSHOT_MAX_BYTES}");
    expect(pageSource).toContain("setPendingFiles(current => [...current, ...files].slice(0, CHAT_SCREENSHOT_MAX_FILES))");
  });

  it("extracts only clipboard images and normalizes filenames before upload", () => {
    expect(pickerSource).toContain("extractClipboardImageFiles(event.clipboardData)");
    expect(pickerSource).toContain("createClipboardImageFile(file");
    expect(pickerSource).toContain('"image/jpeg"');
    expect(pickerSource).toContain('"image/png"');
    expect(pickerSource).toContain('"image/webp"');
    expect(pickerSource).toContain('onError("unsupported-image")');
    expect(pickerSource).toContain('onError("file-too-large")');
    expect(pickerSource).toContain('onError("too-many-files")');
  });

  it("is keyboard focusable and prevents browser paste side effects only for image paste", () => {
    expect(pickerSource).toContain("onPaste={event => void handlePaste(event)}");
    expect(pickerSource).toContain("event.preventDefault()");
    expect(pickerSource).toContain('role="button"');
    expect(pickerSource).toContain("tabIndex={disabled ? -1 : 0}");
    expect(pickerSource).toContain('event.key !== "Enter" && event.key !== " "');
    expect(pickerSource).toContain("onClick={event => event.stopPropagation()}");
  });
});
