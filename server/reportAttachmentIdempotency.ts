import { createHash } from "node:crypto";

export function reportAttachmentContentHash(rawImage: Uint8Array): string {
  return createHash("sha256").update(rawImage).digest("hex");
}

export function reportAttachmentUploadId(rawImage: Uint8Array, label: string): string {
  return createHash("sha256")
    .update(rawImage)
    .update("\0")
    .update(label)
    .digest("hex");
}
