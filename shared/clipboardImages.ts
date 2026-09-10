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
  return Boolean(file && typeof file.type === "string" && file.type.toLowerCase().startsWith("image/"));
}

function fileFingerprint(file: File): string {
  return `${file.name}\u0000${file.type}\u0000${file.size}\u0000${file.lastModified}`;
}

/**
 * Extract image files from a browser clipboard event without touching text or HTML clipboard data.
 * Clipboard items are preferred because some browsers expose the same image through both items and files.
 */
export function extractClipboardImageFiles(data: ClipboardDataLike | null | undefined): File[] {
  if (!data) return [];

  const fromItems = Array.from(data.items || [])
    .filter((item) => item.kind === "file" && item.type.toLowerCase().startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(isImageFile);

  const candidates = fromItems.length > 0
    ? fromItems
    : Array.from(data.files || []).filter(isImageFile);

  const seen = new Set<string>();
  return candidates.filter((file) => {
    const fingerprint = fileFingerprint(file);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}
