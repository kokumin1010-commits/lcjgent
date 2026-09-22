import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { storageGet } from "./storage";

const execFileAsync = promisify(execFile);
export const MIN_VALIDATED_MORNING_AUDIO_SECONDS = 1;
export const MAX_VALIDATED_MORNING_AUDIO_BYTES = 256 * 1024 * 1024;
const MAX_CONCURRENT_MEDIA_VALIDATIONS = 2;
const MAX_QUEUED_MEDIA_VALIDATIONS = 4;
let activeMediaValidations = 0;
const mediaValidationWaiters: Array<() => void> = [];

async function withMediaValidationSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeMediaValidations >= MAX_CONCURRENT_MEDIA_VALIDATIONS) {
    if (mediaValidationWaiters.length >= MAX_QUEUED_MEDIA_VALIDATIONS) {
      throw mediaError("MORNING_AUDIO_VALIDATION_BUSY");
    }
    await new Promise<void>((resolve) => mediaValidationWaiters.push(resolve));
  }
  activeMediaValidations += 1;
  try {
    return await work();
  } finally {
    activeMediaValidations -= 1;
    mediaValidationWaiters.shift()?.();
  }
}

export type ValidatedMorningMeetingMedia = {
  size: number;
  mediaDurationSeconds: number;
  mediaSha256: string;
  mediaValidatedAt: Date;
  audioStreamCount: number;
};

function mediaError(code: string): Error {
  return new Error(code);
}

function mediaFileExtension(mimeType: string): string {
  const normalized = mimeType.split(";", 1)[0].trim().toLowerCase();
  if (normalized === "audio/webm") return ".webm";
  if (normalized === "audio/ogg") return ".ogg";
  if (normalized === "audio/mp4" || normalized === "audio/x-m4a") return ".m4a";
  return ".bin";
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function validateContainerSignature(filePath: string, mimeType: string): Promise<void> {
  const handle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    const isWebm = bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const isOgg = bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "OggS";
    const isMp4 = bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
    const normalized = mimeType.split(";", 1)[0].trim().toLowerCase();
    const valid = normalized === "audio/webm"
      ? isWebm
      : normalized === "audio/ogg"
        ? isOgg
        : normalized === "audio/mp4" || normalized === "audio/x-m4a"
          ? isMp4
          : false;
    if (!valid) throw mediaError("MORNING_AUDIO_SIGNATURE_MISMATCH");
  } finally {
    await handle.close();
  }
}

async function probeValidatedAudio(filePath: string): Promise<Omit<ValidatedMorningMeetingMedia, "size" | "mediaSha256" | "mediaValidatedAt">> {
  let probeOutput: string;
  try {
    const result = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries", "stream=index,codec_name,duration:format=duration",
      "-of", "json",
      filePath,
    ], { timeout: 90_000, maxBuffer: 2 * 1024 * 1024 });
    probeOutput = result.stdout;
  } catch {
    throw mediaError("MORNING_AUDIO_DECODE_FAILED");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(probeOutput);
  } catch {
    throw mediaError("MORNING_AUDIO_DECODE_FAILED");
  }
  const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
  if (streams.length === 0) throw mediaError("MORNING_AUDIO_NO_AUDIO_STREAM");
  const durations = [parsed?.format?.duration, ...streams.map((stream: any) => stream?.duration)]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  const duration = durations.length > 0 ? Math.max(...durations) : 0;

  let volumeOutput = "";
  try {
    const result = await execFileAsync("ffmpeg", [
      "-hide_banner", "-nostdin", "-xerror", "-threads", "1", "-i", filePath,
      "-map", "0:a:0",
      "-af", "volumedetect,aresample=16000,aselect='not(mod(n\\,10))',aspectralstats=measure=entropy+flatness+flux,ametadata=print",
      "-progress", "pipe:1", "-nostats", "-f", "null", "-",
    ], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
    volumeOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
  } catch {
    throw mediaError("MORNING_AUDIO_DECODE_FAILED");
  }
  const maxVolume = volumeOutput.match(/max_volume:\s*(-?inf|-?\d+(?:\.\d+)?)\s*dB/i)?.[1]?.toLowerCase();
  const numericMaxVolume = maxVolume && maxVolume !== "-inf" ? Number(maxVolume) : Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(numericMaxVolume) || numericMaxVolume <= -80) throw mediaError("MORNING_AUDIO_SILENT");
  const decodedDurations = [...volumeOutput.matchAll(/out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (decodedDurations.length === 0) throw mediaError("MORNING_AUDIO_DECODE_FAILED");
  const decodedDuration = Math.max(...decodedDurations);
  const allowedDecodeGap = Math.max(1, duration * 0.05);
  if (duration > 0 && decodedDuration + allowedDecodeGap < duration) {
    throw mediaError("MORNING_AUDIO_DECODE_FAILED");
  }
  const verifiedDuration = duration > 0 ? Math.min(duration, decodedDuration) : decodedDuration;
  if (verifiedDuration < MIN_VALIDATED_MORNING_AUDIO_SECONDS) throw mediaError("MORNING_AUDIO_TOO_SHORT");

  const averageMetric = (name: "entropy" | "flatness" | "flux") => {
    const values = [...volumeOutput.matchAll(new RegExp(`aspectralstats\\.\\d+\\.${name}=([0-9.eE+-]+)`, "g"))]
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value));
    return values.length >= 4 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const spectralEntropy = averageMetric("entropy");
  const spectralFlatness = averageMetric("flatness");
  const spectralFlux = averageMetric("flux");
  if (spectralEntropy == null || spectralFlatness == null || spectralFlux == null
    || spectralEntropy < 0.2 || spectralFlux < 0.012 || spectralFlatness > 0.65) {
    throw mediaError("MORNING_AUDIO_NOT_SPEECH_LIKE");
  }

  return {
    mediaDurationSeconds: Number(verifiedDuration.toFixed(3)),
    audioStreamCount: streams.length,
  };
}

async function validateMorningMeetingAudioFileWithoutQueue(input: {
  filePath: string;
  mimeType?: string;
  declaredSize?: number;
  maxBytes?: number;
}): Promise<ValidatedMorningMeetingMedia> {
  const fileStat = await stat(input.filePath);
  const size = Number(fileStat.size);
  const maxBytes = input.maxBytes || MAX_VALIDATED_MORNING_AUDIO_BYTES;
  if (!Number.isSafeInteger(size) || size <= 0) throw mediaError("MORNING_AUDIO_EMPTY");
  if (size > maxBytes) throw mediaError("MORNING_AUDIO_TOO_LARGE");
  if (input.declaredSize !== undefined && Number(input.declaredSize) !== size) {
    throw mediaError("MORNING_AUDIO_SIZE_MISMATCH");
  }
  if (input.mimeType) await validateContainerSignature(input.filePath, input.mimeType);
  const [probe, mediaSha256] = await Promise.all([
    probeValidatedAudio(input.filePath),
    sha256File(input.filePath),
  ]);
  return {
    size,
    ...probe,
    mediaSha256,
    mediaValidatedAt: new Date(),
  };
}

export async function validateMorningMeetingAudioFileCompletely(input: {
  filePath: string;
  mimeType?: string;
  declaredSize?: number;
  maxBytes?: number;
}): Promise<ValidatedMorningMeetingMedia> {
  return await withMediaValidationSlot(() => validateMorningMeetingAudioFileWithoutQueue(input));
}

export async function validateMorningMeetingAudioBufferCompletely(input: {
  buffer: Buffer;
  mimeType: string;
  maxBytes?: number;
}): Promise<ValidatedMorningMeetingMedia> {
  return await withMediaValidationSlot(async () => {
    const dir = await mkdtemp(join(tmpdir(), "lcj-morning-audio-"));
    const filePath = join(dir, `recording${mediaFileExtension(input.mimeType)}`);
    try {
      await writeFile(filePath, input.buffer);
      return await validateMorningMeetingAudioFileWithoutQueue({
        filePath,
        mimeType: input.mimeType,
        declaredSize: input.buffer.length,
        maxBytes: input.maxBytes,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

async function downloadStoredAudioToFile(url: string, filePath: string): Promise<number> {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw mediaError("MORNING_AUDIO_STORAGE_READ_FAILED");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_VALIDATED_MORNING_AUDIO_BYTES) throw mediaError("MORNING_AUDIO_TOO_LARGE");
  let size = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      size += Buffer.byteLength(chunk);
      if (size > MAX_VALIDATED_MORNING_AUDIO_BYTES) {
        callback(mediaError("MORNING_AUDIO_TOO_LARGE"));
        return;
      }
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body as any), limiter, createWriteStream(filePath));
  if (size <= 0) throw mediaError("MORNING_AUDIO_EMPTY");
  return size;
}

export async function validateStoredMorningMeetingAudio(audioKey: string): Promise<ValidatedMorningMeetingMedia> {
  return await withMediaValidationSlot(async () => {
    const dir = await mkdtemp(join(tmpdir(), "lcj-morning-stored-"));
    const filePath = join(dir, "recording.bin");
    try {
      const { url } = await storageGet(audioKey);
      const size = await downloadStoredAudioToFile(url, filePath);
      return await validateMorningMeetingAudioFileWithoutQueue({ filePath, declaredSize: size });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
