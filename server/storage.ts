// Storage helpers using AWS S3 / Cloudflare R2 (S3-compatible)
// Uses AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_S3_ENDPOINT, AWS_S3_REGION

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

const EXHIBITION_PRIVATE_MAGIC = Buffer.from("LCJEX01", "ascii");
const EXHIBITION_PRIVATE_IV_BYTES = 12;
const EXHIBITION_PRIVATE_TAG_BYTES = 16;

function getS3Client(): S3Client {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const region = process.env.AWS_S3_REGION || "auto";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage credentials missing: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
    );
  }

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Cloudflare R2 requires path-style access
    forcePathStyle: endpoint ? true : false,
  });
}

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("Storage bucket missing: set AWS_S3_BUCKET");
  }
  return bucket;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function getPublicUrl(key: string): string {
  // Use custom CDN domain if set (e.g. Cloudflare R2 custom domain)
  const cdnDomain = process.env.AWS_S3_PUBLIC_URL;
  if (cdnDomain) {
    return `${cdnDomain.replace(/\/+$/, "")}/${key}`;
  }
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const bucket = getBucket();
  if (endpoint) {
    // Cloudflare R2: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
    return `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
  }
  // AWS S3: https://<bucket>.s3.<region>.amazonaws.com/<key>
  const region = process.env.AWS_S3_REGION || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : data;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body as Buffer,
      ContentType: contentType,
    })
  );

  return { key, url: getPublicUrl(key) };
}

function exhibitionPrivateEncryptionKey() {
  const source =
    process.env.EXHIBITION_ASSET_ENCRYPTION_SECRET ||
    process.env.DB_BACKUP_ENCRYPTION_KEY ||
    process.env.EXHIBITION_AUTH_SECRET ||
    process.env.JWT_SECRET;
  if (!source) {
    throw new Error("exhibition asset encryption secret is not configured");
  }
  return createHash("sha256")
    .update(`lcj-exhibition-asset-v1:${source}`)
    .digest();
}

export function encryptExhibitionPrivateObject(
  key: string,
  data: Buffer | Uint8Array
) {
  const iv = randomBytes(EXHIBITION_PRIVATE_IV_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    exhibitionPrivateEncryptionKey(),
    iv
  );
  cipher.setAAD(Buffer.from(key, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(data)),
    cipher.final(),
  ]);
  return Buffer.concat([
    EXHIBITION_PRIVATE_MAGIC,
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);
}

export function decryptExhibitionPrivateObject(key: string, payload: Buffer) {
  const ivStart = EXHIBITION_PRIVATE_MAGIC.length;
  const tagStart = ivStart + EXHIBITION_PRIVATE_IV_BYTES;
  const ciphertextStart = tagStart + EXHIBITION_PRIVATE_TAG_BYTES;
  if (
    payload.length <= ciphertextStart ||
    !payload.subarray(0, ivStart).equals(EXHIBITION_PRIVATE_MAGIC)
  ) {
    throw new Error("invalid encrypted exhibition asset");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    exhibitionPrivateEncryptionKey(),
    payload.subarray(ivStart, tagStart)
  );
  decipher.setAAD(Buffer.from(key, "utf8"));
  decipher.setAuthTag(payload.subarray(tagStart, ciphertextStart));
  return Buffer.concat([
    decipher.update(payload.subarray(ciphertextStart)),
    decipher.final(),
  ]);
}

async function assertAnonymousObjectIsEncrypted(key: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      `${getPublicUrl(key)}?privacy_probe=${Date.now()}`,
      {
        method: "GET",
        headers: { Range: "bytes=0-63", "Cache-Control": "no-cache" },
        redirect: "manual",
        signal: controller.signal,
      }
    );
    if (response.status >= 200 && response.status < 300) {
      const reader = response.body?.getReader();
      if (!reader)
        throw new Error("private object policy could not be verified");
      let prefix = Buffer.alloc(0);
      while (prefix.length < EXHIBITION_PRIVATE_MAGIC.length) {
        const chunk = await reader.read();
        if (chunk.done) break;
        prefix = Buffer.concat([prefix, Buffer.from(chunk.value)]);
      }
      await reader.cancel().catch(() => undefined);
      if (
        prefix
          .subarray(0, EXHIBITION_PRIVATE_MAGIC.length)
          .equals(EXHIBITION_PRIVATE_MAGIC)
      ) {
        return;
      }
      throw new Error("private object is anonymously readable as plaintext");
    }
    if (![401, 403, 404].includes(response.status)) {
      throw new Error(
        `private object policy could not be verified (HTTP ${response.status})`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("private object")) {
      throw error;
    }
    throw new Error("private object policy could not be verified");
  } finally {
    clearTimeout(timeout);
  }
}

export async function storagePutPrivate(
  relKey: string,
  data: Buffer | Uint8Array,
  contentType = "application/octet-stream"
): Promise<{ key: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);
  if (!key.startsWith("private/exhibition/")) {
    throw new Error(
      "private exhibition objects must use the private/exhibition prefix"
    );
  }
  const encrypted = encryptExhibitionPrivateObject(key, data);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: encrypted,
      ContentType: "application/octet-stream",
      CacheControl: "private, no-store, max-age=0",
      Metadata: {
        "lcj-encryption": "aes-256-gcm-v1",
        "original-content-type": contentType.slice(0, 100),
      },
    })
  );
  try {
    await assertAnonymousObjectIsEncrypted(key);
  } catch (error) {
    await client
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      .catch(() => undefined);
    throw error;
  }
  return { key };
}

export async function storagePutFile(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string; size: number }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);
  const fileStat = await stat(filePath);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: fileStat.size,
      ContentType: contentType,
    })
  );

  return { key, url: getPublicUrl(key), size: fileStat.size };
}

export async function storageDelete(relKey: string): Promise<{ key: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  return { key };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(client, command, { expiresIn: 3600 });
  return { key, url };
}

export async function storageReadPrivateBuffer(
  relKey: string
): Promise<Buffer> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);
  if (!key.startsWith("private/exhibition/")) {
    throw new Error("invalid private exhibition object key");
  }
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!object.Body)
    throw new Error("encrypted exhibition asset body is missing");
  const payload = Buffer.from(await object.Body.transformToByteArray());
  return decryptExhibitionPrivateObject(key, payload);
}

export async function storageReadBuffer(relKey: string): Promise<{
  data: Buffer;
  contentType: string | null;
  contentLength: number | null;
}> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!object.Body) throw new Error("Stored object body is missing");
  const bytes = await object.Body.transformToByteArray();
  return {
    data: Buffer.from(bytes),
    contentType: object.ContentType || null,
    contentLength:
      typeof object.ContentLength === "number" ? object.ContentLength : null,
  };
}
