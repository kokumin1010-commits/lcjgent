import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { morningMeetingAudioUploads } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { validateMorningMeetingAudioFileCompletely } from "./morningMeetingMediaValidation";

export const MORNING_MEETING_UPLOAD_MAX_BYTES = 256 * 1024 * 1024;
export const MORNING_MEETING_UPLOAD_SCOPE = "morning-meeting-audio-upload";

export type MorningMeetingAudioMimeType = "audio/webm" | "audio/ogg" | "audio/mp4" | "audio/x-m4a";

export type MorningMeetingAudioUploadClaim = {
  scope: typeof MORNING_MEETING_UPLOAD_SCOPE;
  uploadId: string;
  userId: number;
  key: string;
  url: string;
  mimeType: MorningMeetingAudioMimeType;
  size: number;
  mediaDurationSeconds: number;
  mediaSha256: string;
  mediaValidatedAt: string;
  audioStreamCount: number;
};

const ALLOWED_MIME_TYPES = new Set<MorningMeetingAudioMimeType>([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
]);

function tokenSecret(): Uint8Array {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required for morning meeting uploads");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export function normalizeMorningMeetingAudioMimeType(value: string): MorningMeetingAudioMimeType | null {
  const baseType = String(value || "").split(";", 1)[0].trim().toLowerCase();
  const mimeType = (baseType === "video/mp4" ? "audio/mp4"
    : baseType === "video/webm" ? "audio/webm"
      : baseType) as MorningMeetingAudioMimeType;
  return ALLOWED_MIME_TYPES.has(mimeType) ? mimeType : null;
}

export function morningMeetingAudioExtension(mimeType: MorningMeetingAudioMimeType): "webm" | "ogg" | "m4a" {
  if (mimeType === "audio/ogg") return "ogg";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  return "webm";
}

export async function validateMorningMeetingAudioFile(input: {
  filePath: string;
  mimeType: string;
  declaredSize?: number;
}): Promise<{
  mimeType: MorningMeetingAudioMimeType;
  size: number;
  mediaDurationSeconds: number;
  mediaSha256: string;
  mediaValidatedAt: Date;
  audioStreamCount: number;
}> {
  const mimeType = normalizeMorningMeetingAudioMimeType(input.mimeType);
  if (!mimeType) throw new Error("MORNING_AUDIO_UNSUPPORTED_FORMAT");
  const validated = await validateMorningMeetingAudioFileCompletely({
    filePath: input.filePath,
    mimeType,
    declaredSize: input.declaredSize,
    maxBytes: MORNING_MEETING_UPLOAD_MAX_BYTES,
  });
  return { mimeType, ...validated };
}

export async function createMorningMeetingAudioUploadToken(
  claim: Omit<MorningMeetingAudioUploadClaim, "scope" | "uploadId">,
): Promise<string> {
  const uploadId = randomUUID();
  const db = await getDb();
  if (!db) throw new Error("MORNING_AUDIO_UPLOAD_STORAGE_UNAVAILABLE");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await db.insert(morningMeetingAudioUploads).values({
    uploadId,
    userId: claim.userId,
    storageKey: claim.key,
    storageUrl: claim.url,
    mimeType: claim.mimeType,
    size: claim.size,
    mediaDurationSeconds: claim.mediaDurationSeconds.toFixed(3),
    mediaSha256: claim.mediaSha256,
    mediaValidatedAt: new Date(claim.mediaValidatedAt),
    audioStreamCount: claim.audioStreamCount,
    expiresAt,
  });
  return await new SignJWT({
    scope: MORNING_MEETING_UPLOAD_SCOPE,
    userId: claim.userId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setJti(uploadId)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(tokenSecret());
}

export async function verifyMorningMeetingAudioUploadToken(
  token: string,
  expectedUserId: number,
  options: { allowConsumed?: boolean } = {},
): Promise<MorningMeetingAudioUploadClaim> {
  const { payload } = await jwtVerify(token, tokenSecret(), { algorithms: ["HS256"] });
  const scope = payload.scope;
  const uploadId = typeof payload.jti === "string" ? payload.jti : "";
  const userId = Number(payload.userId);
  if (
    scope !== MORNING_MEETING_UPLOAD_SCOPE
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)
    || userId !== expectedUserId
  ) {
    throw new Error("MORNING_AUDIO_UPLOAD_TOKEN_INVALID");
  }

  const db = await getDb();
  if (!db) throw new Error("MORNING_AUDIO_UPLOAD_TOKEN_INVALID");
  const [stored] = await db.select().from(morningMeetingAudioUploads)
    .where(and(
      eq(morningMeetingAudioUploads.uploadId, uploadId),
      eq(morningMeetingAudioUploads.userId, expectedUserId),
      ...(options.allowConsumed ? [] : [isNull(morningMeetingAudioUploads.consumedAt)]),
    ))
    .limit(1);
  const key = String(stored?.storageKey || "");
  const url = String(stored?.storageUrl || "");
  const mimeType = normalizeMorningMeetingAudioMimeType(String(stored?.mimeType || ""));
  const size = Number(stored?.size);
  const mediaDurationSeconds = Number(stored?.mediaDurationSeconds);
  const mediaSha256 = String(stored?.mediaSha256 || "");
  const mediaValidatedAt = stored?.mediaValidatedAt instanceof Date
    ? stored.mediaValidatedAt.toISOString()
    : String(stored?.mediaValidatedAt || "");
  const audioStreamCount = Number(stored?.audioStreamCount);
  if (!stored
    || new Date(stored.expiresAt).getTime() <= Date.now()
    || !key.startsWith(`morning-meeting-uploads/user-${expectedUserId}/`)
    || !url || !mimeType || !Number.isSafeInteger(size) || size <= 0 || size > MORNING_MEETING_UPLOAD_MAX_BYTES
    || !Number.isFinite(mediaDurationSeconds) || mediaDurationSeconds < 1
    || !/^[a-f0-9]{64}$/.test(mediaSha256)
    || Number.isNaN(new Date(mediaValidatedAt).getTime())
    || !Number.isInteger(audioStreamCount) || audioStreamCount < 1) {
    throw new Error("MORNING_AUDIO_UPLOAD_TOKEN_INVALID");
  }

  return {
    scope: MORNING_MEETING_UPLOAD_SCOPE,
    uploadId,
    userId,
    key,
    url,
    mimeType,
    size,
    mediaDurationSeconds,
    mediaSha256,
    mediaValidatedAt,
    audioStreamCount,
  };
}
