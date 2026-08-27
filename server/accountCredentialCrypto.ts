import crypto from "node:crypto";

const ENVELOPE_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getCredentialKey(): Buffer {
  const secret = process.env.ACCOUNT_CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ACCOUNT_CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET with at least 16 characters is required",
    );
  }
  return crypto
    .createHash("sha256")
    .update(`lcj-account-credentials:v1:${secret}`, "utf8")
    .digest();
}

export function isEncryptedAccountSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENVELOPE_PREFIX);
}

export function encryptAccountSecret(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value : "";
  if (!normalized) return null;
  if (isEncryptedAccountSecret(normalized)) return normalized;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCredentialKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${ENVELOPE_PREFIX}${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptAccountSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncryptedAccountSecret(value)) {
    // Backward compatibility for manually-created historical rows. New writes are encrypted.
    return value;
  }

  const payload = value.slice(ENVELOPE_PREFIX.length);
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid account credential envelope");
  }
  const [ivEncoded, tagEncoded, ciphertextEncoded] = parts;
  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(tagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid account credential envelope length");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getCredentialKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
