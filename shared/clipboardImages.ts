export type ClipboardFileLike = File & {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

export type ClipboardItemLike = {
  kind: string;
  type: string;
  getAsFile(): File | null;
};

export type ClipboardDataLike = {
  items?: ArrayLike<ClipboardItemLike> | null;
  files?: ArrayLike<File> | null;
};

function isImageFile(file: File | null | undefined): file is File {
  return Boolean(
    file &&
      typeof file.type === "string" &&
      file.type.toLowerCase().startsWith("image/")
  );
}

function fileFingerprint(file: File): string {
  return `${file.name}\u0000${file.type}\u0000${file.size}\u0000${file.lastModified}`;
}

const CLIPBOARD_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Give clipboard images a server-safe filename whose extension always matches the MIME type.
 * Browser-created clipboard files may have an empty name or a mismatched generic extension.
 */
export function createClipboardImageFile(
  file: File,
  prefix: string,
  now = Date.now()
): File | null {
  const mimeType = file.type.toLowerCase();
  const extension = CLIPBOARD_IMAGE_EXTENSIONS[mimeType];
  if (!extension) return null;

  const safePrefix =
    prefix
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "clipboard-image";

  return new File([file], `${safePrefix}-${now}.${extension}`, {
    type: mimeType,
    lastModified: file.lastModified || now,
  });
}

/**
 * Extract image files from a browser clipboard event without touching text or HTML clipboard data.
 * Clipboard items are preferred because some browsers expose the same image through both items and files.
 */
export function extractClipboardImageFiles(
  data: ClipboardDataLike | null | undefined
): File[] {
  if (!data) return [];

  const fromItems = Array.from(data.items || [])
    .filter(
      item =>
        item.kind === "file" && item.type.toLowerCase().startsWith("image/")
    )
    .map(item => item.getAsFile())
    .filter(isImageFile);

  const candidates =
    fromItems.length > 0
      ? fromItems
      : Array.from(data.files || []).filter(isImageFile);

  const seen = new Set<string>();
  return candidates.filter(file => {
    const fingerprint = fileFingerprint(file);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}
