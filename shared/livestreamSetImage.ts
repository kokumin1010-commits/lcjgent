export const LIVESTREAM_SET_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const LIVESTREAM_SET_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type LivestreamSetImageFileLike = {
  name: string;
  type: string;
  size: number;
};

export function validateLivestreamSetImage(
  file: LivestreamSetImageFileLike
): string | null {
  if (
    !LIVESTREAM_SET_IMAGE_MIME_TYPES.includes(
      file.type as (typeof LIVESTREAM_SET_IMAGE_MIME_TYPES)[number]
    )
  ) {
    return "JPEG、PNG、WebP画像のみアップロードできます";
  }
  if (file.size <= 0) return "画像ファイルが空です";
  if (file.size > LIVESTREAM_SET_IMAGE_MAX_BYTES)
    return "画像は8MB以下にしてください";
  return null;
}

export function normalizeLivestreamSetQuantity(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 1;
}

export function hasCompleteLivestreamSetImageReference(imageUrl?: string | null, imageKey?: string | null): boolean {
  return Boolean(imageUrl?.trim()) === Boolean(imageKey?.trim());
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("画像データの形式が正しくありません"));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function replaceObjectUrl(
  previousUrl: string | null | undefined,
  file: File
): string {
  if (previousUrl?.startsWith("blob:")) URL.revokeObjectURL(previousUrl);
  return URL.createObjectURL(file);
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}
