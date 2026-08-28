export const STORE_PRODUCT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const STORE_PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const STORE_PRODUCT_IMAGE_MAX_COUNT = 8;

export type StoreProductImageRejectionReason =
  | "unsupported_type"
  | "too_large"
  | "limit_exceeded";

export type StoreProductImageRejection = {
  file: File;
  reason: StoreProductImageRejectionReason;
};

export function extractClipboardImageFiles(
  clipboardData: Pick<DataTransfer, "items" | "files">
): File[] {
  const fromItems = Array.from(clipboardData.items || [])
    .filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  const candidates =
    fromItems.length > 0
      ? fromItems
      : Array.from(clipboardData.files || []).filter(file =>
          file.type.startsWith("image/")
        );

  const seen = new Set<string>();
  return candidates.filter(file => {
    const key = `${file.name}:${file.type}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateStoreProductImageFiles(
  files: readonly File[],
  availableSlots: number
): { accepted: File[]; rejected: StoreProductImageRejection[] } {
  const accepted: File[] = [];
  const rejected: StoreProductImageRejection[] = [];
  let remainingSlots = Math.max(0, availableSlots);

  for (const file of files) {
    if (
      !STORE_PRODUCT_IMAGE_TYPES.includes(
        file.type as (typeof STORE_PRODUCT_IMAGE_TYPES)[number]
      )
    ) {
      rejected.push({ file, reason: "unsupported_type" });
      continue;
    }
    if (file.size > STORE_PRODUCT_IMAGE_MAX_BYTES) {
      rejected.push({ file, reason: "too_large" });
      continue;
    }
    if (remainingSlots === 0) {
      rejected.push({ file, reason: "limit_exceeded" });
      continue;
    }
    accepted.push(file);
    remainingSlots -= 1;
  }

  return { accepted, rejected };
}
