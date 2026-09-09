export type PreparedLivestreamImage = {
  base64: string;
  filename: string;
  mimeType: "image/jpeg";
  byteLength: number;
};

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MAX_HEIGHT = 1920;
const DEFAULT_QUALITY = 0.82;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_LENGTH = 12_000_000;

function stripExtension(filename: string): string {
  const normalized = filename.trim() || "livestream-image";
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
}

function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) throw new Error("画像データの形式が正しくありません");
  return dataUrl.slice(commaIndex + 1);
}

function estimateDecodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function prepareLivestreamImageForUpload(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; prefix?: string } = {},
): Promise<PreparedLivestreamImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("JPEG・PNG・WebP画像のみアップロードできます");
  }

  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      element.src = objectUrl;
    });

    const ratio = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像の変換を開始できませんでした");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const base64 = dataUrlToBase64(canvas.toDataURL("image/jpeg", quality));
    const byteLength = estimateDecodedBytes(base64);
    if (byteLength <= 0 || byteLength > MAX_UPLOAD_BYTES || base64.length > MAX_BASE64_LENGTH) {
      throw new Error("画像を8MB以下にしてください");
    }

    const prefix = options.prefix?.trim();
    const safeBaseName = stripExtension(file.name).replace(/[^A-Za-z0-9._-]+/g, "-") || "livestream-image";
    return {
      base64,
      filename: `${prefix ? `${prefix}-` : ""}${safeBaseName}.jpg`,
      mimeType: "image/jpeg",
      byteLength,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function getLiverRecordErrorMessage(error: unknown, language: string): string {
  const fallback = language === "ja" ? "保存に失敗しました" : "保存失败";
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const message = rawMessage.trim();

  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return language === "ja"
      ? "通信が中断されました。入力内容は保持されています。通信を確認して、もう一度保存してください。"
      : "网络连接中断。输入内容已保留，请确认网络后重新保存。";
  }
  return message || fallback;
}

export function isLiverRecordNetworkError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}
