import crypto from "node:crypto";

/**
 * LINE requires X-Line-Retry-Key to be a UUID. Derive a stable UUID from a
 * durable webhook/message identifier plus a purpose so redelivery and another
 * app instance submit the same key, while separate messages remain distinct.
 */
export function createLineRetryKey(seed: string): string {
  const hex = crypto.createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  const variant = Number.parseInt(hex[16], 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
