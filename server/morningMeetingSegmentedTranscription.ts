import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  transcribeAudio,
  type TranscribeOptions,
  type TranscriptionError,
  type TranscriptionResponse,
  type WhisperSegment,
} from "./_core/voiceTranscription";
import { transcribeMorningMeetingWithQualityRetry } from "./morningMeetingTranscriptionQuality";
import { MORNING_MEETING_UPLOAD_MAX_BYTES } from "./morningMeetingAudioUpload";

const execFileAsync = promisify(execFile);
const CHUNK_SECONDS = 240;
const MAX_CHUNKS = 120;
const NORMALIZED_AUDIO_BITRATE = "32k";

type SegmentedTranscriber = (options: TranscribeOptions) => Promise<TranscriptionResponse | TranscriptionError>;

function serviceError(details: string): TranscriptionError {
  return { error: "Morning meeting audio preprocessing failed", code: "SERVICE_ERROR", details };
}

async function downloadAudioToFile(audioUrl: string, destination: string): Promise<void> {
  const response = await fetch(audioUrl, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) {
    throw new Error(`AUDIO_DOWNLOAD_HTTP_${response.status}`);
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MORNING_MEETING_UPLOAD_MAX_BYTES) {
    throw new Error("MORNING_AUDIO_TOO_LARGE");
  }

  let received = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      received += Buffer.byteLength(chunk);
      if (received > MORNING_MEETING_UPLOAD_MAX_BYTES) {
        callback(new Error("MORNING_AUDIO_TOO_LARGE"));
        return;
      }
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body as never),
    limiter,
    createWriteStream(destination, { flags: "wx", mode: 0o600 }),
  );
}

async function normalizedChunkDuration(path: string): Promise<number> {
  const result = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
    { timeout: 60_000, maxBuffer: 128 * 1024 },
  );
  const duration = Number(String(result.stdout || "").trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("MORNING_AUDIO_CHUNK_DURATION_INVALID");
  return duration;
}

async function normalizeAndSplitAudio(
  sourcePath: string,
  outputDir: string,
): Promise<Array<{ path: string; durationSeconds: number }>> {
  const outputPattern = join(outputDir, "chunk-%03d.mp3");
  await execFileAsync(
    "ffmpeg",
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", sourcePath,
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libmp3lame",
      "-b:a", NORMALIZED_AUDIO_BITRATE,
      "-f", "segment",
      "-segment_time", String(CHUNK_SECONDS),
      "-reset_timestamps", "1",
      outputPattern,
    ],
    { timeout: 15 * 60 * 1000, maxBuffer: 1024 * 1024 },
  );

  const chunkNames = (await readdir(outputDir))
    .filter(name => /^chunk-\d{3}\.mp3$/.test(name))
    .sort();
  if (chunkNames.length === 0 || chunkNames.length > MAX_CHUNKS) {
    throw new Error("MORNING_AUDIO_CHUNK_COUNT_INVALID");
  }

  const chunks: Array<{ path: string; durationSeconds: number }> = [];
  for (const name of chunkNames) {
    const path = join(outputDir, name);
    const fileStat = await stat(path);
    if (fileStat.size <= 0 || fileStat.size > 16 * 1024 * 1024) {
      throw new Error("MORNING_AUDIO_CHUNK_SIZE_INVALID");
    }
    chunks.push({ path, durationSeconds: await normalizedChunkDuration(path) });
  }
  return chunks;
}

export function mergeMorningMeetingChunkResponses(
  responses: TranscriptionResponse[],
  chunkDurations: number[] = [],
): TranscriptionResponse {
  let offsetSeconds = 0;
  let nextSegmentId = 0;
  const segments: WhisperSegment[] = [];
  const textParts: string[] = [];

  responses.forEach((response, responseIndex) => {
    const responseDuration = Math.max(
      Number(response.duration) || 0,
      ...response.segments.map(segment => Number(segment.end) || 0),
    );
    const chunkText = String(response.text || "").trim();
    if (chunkText) textParts.push(chunkText);
    for (const segment of response.segments) {
      segments.push({
        ...segment,
        id: nextSegmentId++,
        start: Math.max(0, Number(segment.start) || 0) + offsetSeconds,
        end: Math.max(0, Number(segment.end) || 0) + offsetSeconds,
      });
    }
    const verifiedDuration = Number(chunkDurations[responseIndex]);
    offsetSeconds += Number.isFinite(verifiedDuration) && verifiedDuration > 0
      ? verifiedDuration
      : responseDuration;
  });

  return {
    task: "transcribe",
    language: responses.find(response => response.language)?.language || "",
    duration: offsetSeconds,
    text: textParts.join("\n"),
    segments,
  };
}

async function createSegmentedTranscriber(
  audioUrl: string,
  baseTranscriber: SegmentedTranscriber = transcribeAudio,
  onChunkCompleted?: (completed: number, total: number) => Promise<void> | void,
): Promise<{
  transcribe: SegmentedTranscriber;
  cleanup: () => Promise<void>;
  chunkCount: number;
}> {
  const workDir = await mkdtemp(join(tmpdir(), "lcj-morning-audio-"));
  const sourcePath = join(workDir, "source-audio");
  try {
    await downloadAudioToFile(audioUrl, sourcePath);
    const chunks = await normalizeAndSplitAudio(sourcePath, workDir);
    const transcribe: SegmentedTranscriber = async (options) => {
      const responses: TranscriptionResponse[] = [];
      for (const chunkInfo of chunks) {
        const chunk = await readFile(chunkInfo.path);
        const chunkUrl = `data:audio/mpeg;base64,${chunk.toString("base64")}`;
        const response = await baseTranscriber({
          audioUrl: chunkUrl,
          language: options.language,
          prompt: options.prompt,
        });
        if ("error" in response) return response;
        responses.push(response);
        await onChunkCompleted?.(responses.length, chunks.length);
      }
      return mergeMorningMeetingChunkResponses(
        responses,
        chunks.map(chunk => chunk.durationSeconds),
      );
    };
    return {
      transcribe,
      chunkCount: chunks.length,
      cleanup: async () => { await rm(workDir, { recursive: true, force: true }); },
    };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}

export async function transcribeSegmentedMorningMeetingWithQualityRetry(input: {
  audioUrl: string;
  language: "zh" | "ja";
  primaryPrompt: string;
  expectedDurationSeconds: number;
  transcribeChunk?: SegmentedTranscriber;
  onChunkCompleted?: (completed: number, total: number) => Promise<void> | void;
}) {
  let prepared: Awaited<ReturnType<typeof createSegmentedTranscriber>>;
  try {
    prepared = await createSegmentedTranscriber(input.audioUrl, input.transcribeChunk, input.onChunkCompleted);
  } catch (error) {
    const details = error instanceof Error ? error.message : "UNKNOWN_PREPROCESSING_ERROR";
    const fallback: SegmentedTranscriber = async () => serviceError(details);
    const result = await transcribeMorningMeetingWithQualityRetry({
      audioUrl: input.audioUrl,
      language: input.language,
      primaryPrompt: input.primaryPrompt,
      expectedDurationSeconds: input.expectedDurationSeconds,
      transcribe: fallback,
    });
    return { ...result, audioChunkCount: 0 };
  }

  try {
    const result = await transcribeMorningMeetingWithQualityRetry({
      audioUrl: input.audioUrl,
      language: input.language,
      primaryPrompt: input.primaryPrompt,
      expectedDurationSeconds: input.expectedDurationSeconds,
      transcribe: prepared.transcribe,
    });
    return { ...result, audioChunkCount: prepared.chunkCount };
  } finally {
    await prepared.cleanup();
  }
}
