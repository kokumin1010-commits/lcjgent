import { open, stat } from "node:fs/promises";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

export const MORNING_MEETING_UPLOAD_MAX_BYTES = 256 * 1024 * 1024;
export const MORNING_MEETING_UPLOAD_SCOPE = "morning-meeting-audio-upload";

export type MorningMeetingAudioMimeType = "audio/webm" | "audio/ogg" | "audio/mp4" | "audio/x-m4a";

export type MorningMeetingAudioUploadClaim = {
  scope: typeof MORNING_MEETING_UPLOAD_SCOPE;
  userId: number;
  key: string;
  url: string;
  mimeType: MorningMeetingAudioMimeType;
  size: number;
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
  const mimeType = String(value || "").split(";", 1)[0].trim().toLowerCase() as MorningMeetingAudioMimeType;
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
}): Promise<{ mimeType: MorningMeetingAudioMimeType; size: number }> {
  const mimeType = normalizeMorningMeetingAudioMimeType(input.mimeType);
  if (!mimeType) throw new Error("MORNING_AUDIO_UNSUPPORTED_FORMAT");

  const fileStat = await stat(input.filePath);
  const size = Number(fileStat.size);
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("MORNING_AUDIO_EMPTY");
  if (size > MORNING_MEETING_UPLOAD_MAX_BYTES) throw new Error("MORNING_AUDIO_TOO_LARGE");
  if (input.declaredSize !== undefined && Number(input.declaredSize) !== size) {
    throw new Error("MORNING_AUDIO_SIZE_MISMATCH");
  }

  const handle = await open(input.filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    const isWebm = bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const isOgg = bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "OggS";
    const isMp4 = bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
    const signatureValid = mimeType === "audio/webm" ? isWebm : mimeType === "audio/ogg" ? isOgg : isMp4;
    if (!signatureValid) throw new Error("MORNING_AUDIO_SIGNATURE_MISMATCH");
  } finally {
    await handle.close();
  }

  return { mimeType, size };
}

export async function createMorningMeetingAudioUploadToken(
  claim: Omit<MorningMeetingAudioUploadClaim, "scope">,
): Promise<string> {
  return await new SignJWT({
    scope: MORNING_MEETING_UPLOAD_SCOPE,
    userId: claim.userId,
    key: claim.key,
    url: claim.url,
    mimeType: claim.mimeType,
    size: claim.size,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(tokenSecret());
}

export async function verifyMorningMeetingAudioUploadToken(
  token: string,
  expectedUserId: number,
): Promise<MorningMeetingAudioUploadClaim> {
  const { payload } = await jwtVerify(token, tokenSecret(), { algorithms: ["HS256"] });
  const scope = payload.scope;
  const userId = Number(payload.userId);
  const key = typeof payload.key === "string" ? payload.key : "";
  const url = typeof payload.url === "string" ? payload.url : "";
  const mimeType = normalizeMorningMeetingAudioMimeType(String(payload.mimeType || ""));
  const size = Number(payload.size);

  if (
    scope !== MORNING_MEETING_UPLOAD_SCOPE
    || userId !== expectedUserId
    || !key.startsWith(`morning-meeting-uploads/user-${expectedUserId}/`)
    || !url
    || !mimeType
    || !Number.isSafeInteger(size)
    || size <= 0
    || size > MORNING_MEETING_UPLOAD_MAX_BYTES
  ) {
    throw new Error("MORNING_AUDIO_UPLOAD_TOKEN_INVALID");
  }

  return {
    scope: MORNING_MEETING_UPLOAD_SCOPE,
    userId,
    key,
    url,
    mimeType,
    size,
  };
}
