// Storage helpers using AWS S3 / Cloudflare R2 (S3-compatible)
// Uses AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_S3_ENDPOINT, AWS_S3_REGION

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body as Buffer,
    ContentType: contentType,
  });

  await client.send(command);

  const url = getPublicUrl(key);
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);

  // Generate a pre-signed URL valid for 1 hour
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn: 3600 });
  return { key, url };
}
