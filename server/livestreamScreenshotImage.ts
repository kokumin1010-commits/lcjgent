const HEADER_HEIGHT_RATIO = 0.1;
const HEADER_LEFT_RATIO = 0.04;
const HEADER_WIDTH_RATIO = 0.88;
const MIN_HEADER_HEIGHT = 48;
const MAX_OUTPUT_WIDTH = 4096;

export async function createLivestreamHeaderCropDataUrl(
  imageBase64: string,
): Promise<string | null> {
  try {
    const payload = imageBase64.includes(",")
      ? imageBase64.slice(imageBase64.indexOf(",") + 1)
      : imageBase64;
    const source = Buffer.from(payload, "base64");
    if (source.length === 0) return null;

    const sharp = (await import("sharp")).default;
    const metadata = await sharp(source).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 100 || height < 100) return null;

    const cropLeft = Math.floor(width * HEADER_LEFT_RATIO);
    const cropWidth = Math.max(1, Math.min(width - cropLeft, Math.ceil(width * HEADER_WIDTH_RATIO)));
    const cropHeight = Math.min(
      height,
      Math.max(MIN_HEADER_HEIGHT, Math.ceil(height * HEADER_HEIGHT_RATIO)),
    );
    const outputWidth = Math.min(MAX_OUTPUT_WIDTH, Math.max(cropWidth, cropWidth * 4));
    const cropped = await sharp(source)
      .extract({ left: cropLeft, top: 0, width: cropWidth, height: cropHeight })
      .resize({ width: outputWidth, withoutEnlargement: false })
      .sharpen()
      .jpeg({ quality: 92 })
      .toBuffer();

    return `data:image/jpeg;base64,${cropped.toString("base64")}`;
  } catch (error) {
    console.warn("[LivestreamScreenshot] header crop failed", error);
    return null;
  }
}
