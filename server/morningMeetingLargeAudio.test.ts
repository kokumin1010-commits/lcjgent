import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import type { TranscriptionResponse, WhisperSegment } from "./_core/voiceTranscription";

const { getDb, uploadedRows } = vi.hoisted(() => ({
  getDb: vi.fn(),
  uploadedRows: [] as any[],
}));
vi.mock("./db", () => ({ getDb }));

import {
  createMorningMeetingAudioUploadToken,
  validateMorningMeetingAudioFile,
  verifyMorningMeetingAudioUploadToken,
} from "./morningMeetingAudioUpload";
import {
  mergeMorningMeetingChunkResponses,
  transcribeSegmentedMorningMeetingWithQualityRetry,
} from "./morningMeetingSegmentedTranscription";
import { assessMorningMeetingTranscription } from "./morningMeetingTranscriptionQuality";
import { isRecordedTeamMeetingAttendance } from "./teamMorningMeetingPolicy";

const indexSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./morningMeetingRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/MorningMeeting.tsx", import.meta.url), "utf8");
const dockerSource = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("./storage.ts", import.meta.url), "utf8");
const mediaValidationSource = readFileSync(new URL("./morningMeetingMediaValidation.ts", import.meta.url), "utf8");

let workDir = "";
const originalCookieSecret = ENV.cookieSecret;
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

function syntheticSilentWav(durationSeconds = 1, sampleRate = 16_000): Buffer {
  const dataSize = durationSeconds * sampleRate * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function segment(id: number, start: number, end: number, text: string): WhisperSegment {
  return {
    id,
    seek: 0,
    start,
    end,
    text,
    tokens: [],
    temperature: 0,
    avg_logprob: -0.2,
    compression_ratio: 1.1,
    no_speech_prob: 0.01,
  };
}

function response(duration: number, segments: WhisperSegment[]): TranscriptionResponse {
  return {
    task: "transcribe",
    language: "zh",
    duration,
    text: segments.map(item => item.text).join("\n"),
    segments,
  };
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "lcj-morning-large-audio-test-"));
  ENV.cookieSecret = "synthetic-morning-upload-secret-with-at-least-32-bytes";
  getDb.mockResolvedValue({
    insert: () => ({ values: async (value: any) => { uploadedRows.push(value); } }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => uploadedRows.length ? [uploadedRows.at(-1)] : [] }),
      }),
    }),
  });
});

beforeEach(() => {
  uploadedRows.length = 0;
});

afterAll(async () => {
  ENV.cookieSecret = originalCookieSecret;
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("morning meeting large-audio safety", () => {
  it.runIf(hasFfmpeg)("fully decodes audible audio instead of trusting a container header", async () => {
    const validPath = join(workDir, "valid.webm");
    const safariMp4Path = join(workDir, "safari-audio.m4a");
    const silentPath = join(workDir, "silent.webm");
    const shortPath = join(workDir, "short.webm");
    const tonePath = join(workDir, "tone.webm");
    const noisePath = join(workDir, "noise.webm");
    const chirpPath = join(workDir, "chirp.webm");
    const modulatedTonePath = join(workDir, "modulated-tone.webm");
    const videoOnlyPath = join(workDir, "video-only.webm");
    const truncatedPath = join(workDir, "truncated.webm");
    const fakeHeaderPath = join(workDir, "fake-header.webm");
    const invalidPath = join(workDir, "invalid.webm");
    const fakeWebmHeader = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(60, 0),
    ]);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "flite=text='Good morning team. Today we will discuss work plans and support requests.'",
      "-ar", "16000",
      "-c:a", "libopus", "-y", validPath,
    ]).status).toBe(0);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "flite=text='Good morning team. This validates mobile Safari audio.'",
      "-ar", "16000",
      "-c:a", "aac", "-y", safariMp4Path,
    ]).status).toBe(0);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "anullsrc=r=16000:cl=mono", "-t", "1.2",
      "-c:a", "libopus", "-y", silentPath,
    ]).status).toBe(0);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "sine=frequency=440:sample_rate=16000:duration=0.4",
      "-c:a", "libopus", "-y", shortPath,
    ]).status).toBe(0);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "sine=frequency=440:sample_rate=16000:duration=4",
      "-c:a", "libopus", "-y", tonePath,
    ]).status).toBe(0);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "anoisesrc=color=white:sample_rate=16000:duration=4:amplitude=0.1",
      "-c:a", "libopus", "-y", noisePath,
    ]).status).toBe(0);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "aevalsrc=0.2*sin(2*PI*(300*t+150*t*t)):s=16000:d=8",
      "-c:a", "libopus", "-y", chirpPath,
    ]).status).toBe(0);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "aevalsrc=0.2*(1+0.7*sin(2*PI*3*t))*sin(2*PI*(500*t+30*sin(2*PI*2*t))):s=16000:d=8",
      "-c:a", "libopus", "-y", modulatedTonePath,
    ]).status).toBe(0);
    expect(spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "color=c=black:s=16x16:d=1.2", "-an", "-c:v", "libvpx-vp9", "-y", videoOnlyPath,
    ]).status).toBe(0);
    const validBytes = await readFile(validPath);
    await writeFile(truncatedPath, validBytes.subarray(0, Math.floor(validBytes.length * 0.7)));
    await writeFile(fakeHeaderPath, fakeWebmHeader);
    await writeFile(invalidPath, Buffer.alloc(64, 0x41));

    await expect(validateMorningMeetingAudioFile({
      filePath: validPath,
      mimeType: "audio/webm;codecs=opus",
    })).resolves.toEqual(expect.objectContaining({
      mimeType: "audio/webm",
      mediaDurationSeconds: expect.any(Number),
      mediaSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      audioStreamCount: 1,
    }));
    await expect(validateMorningMeetingAudioFile({
      filePath: safariMp4Path,
      mimeType: "video/mp4;codecs=mp4a.40.2",
    })).resolves.toEqual(expect.objectContaining({
      mimeType: "audio/mp4",
      audioStreamCount: 1,
    }));

    await expect(validateMorningMeetingAudioFile({
      filePath: fakeHeaderPath,
      mimeType: "audio/webm",
      declaredSize: fakeWebmHeader.length,
    })).rejects.toThrow("MORNING_AUDIO_DECODE_FAILED");

    await expect(validateMorningMeetingAudioFile({
      filePath: truncatedPath,
      mimeType: "audio/webm",
    })).rejects.toThrow("MORNING_AUDIO_DECODE_FAILED");

    await expect(validateMorningMeetingAudioFile({
      filePath: silentPath,
      mimeType: "audio/webm",
    })).rejects.toThrow("MORNING_AUDIO_SILENT");

    await expect(validateMorningMeetingAudioFile({
      filePath: shortPath,
      mimeType: "audio/webm",
    })).rejects.toThrow("MORNING_AUDIO_TOO_SHORT");

    for (const transcriptionUnavailablePath of [tonePath, noisePath, chirpPath, modulatedTonePath]) {
      const media = await validateMorningMeetingAudioFile({ filePath: transcriptionUnavailablePath, mimeType: "audio/webm" });
      expect(isRecordedTeamMeetingAttendance({
        status: "failed",
        audioKey: `private/${transcriptionUnavailablePath.split("/").at(-1)}`,
        participantSnapshot: [{ targetKey: "staff:44" }],
        mediaValidatedAt: media.mediaValidatedAt,
        mediaDurationSeconds: media.mediaDurationSeconds,
        mediaSha256: media.mediaSha256,
        mediaAudioStreamCount: media.audioStreamCount,
        speechValidatedAt: null,
        speechValidationProvider: null,
      })).toBe(true);
    }

    await expect(validateMorningMeetingAudioFile({
      filePath: videoOnlyPath,
      mimeType: "audio/webm",
    })).rejects.toThrow("MORNING_AUDIO_NO_AUDIO_STREAM");

    await expect(validateMorningMeetingAudioFile({
      filePath: invalidPath,
      mimeType: "audio/webm",
      declaredSize: 64,
    })).rejects.toThrow("MORNING_AUDIO_SIGNATURE_MISMATCH");
  });

  it("binds an uploaded audio token to its authenticated owner", async () => {
    const token = await createMorningMeetingAudioUploadToken({
      userId: 41,
      key: "morning-meeting-uploads/user-41/synthetic.webm",
      url: "https://storage.example.test/synthetic.webm",
      mimeType: "audio/webm",
      size: 1024,
      mediaDurationSeconds: 120.25,
      mediaSha256: "a".repeat(64),
      mediaValidatedAt: "2026-09-21T01:00:00.000Z",
      audioStreamCount: 1,
    });
    const tokenPayload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    expect(tokenPayload).not.toHaveProperty("key");
    expect(tokenPayload).not.toHaveProperty("url");
    expect(tokenPayload).not.toHaveProperty("mediaSha256");

    await expect(verifyMorningMeetingAudioUploadToken(token, 41)).resolves.toEqual(expect.objectContaining({
      userId: 41,
      mimeType: "audio/webm",
      size: 1024,
      uploadId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      mediaDurationSeconds: 120.25,
      mediaSha256: "a".repeat(64),
      audioStreamCount: 1,
    }));
    await expect(verifyMorningMeetingAudioUploadToken(token, 42)).rejects.toThrow("MORNING_AUDIO_UPLOAD_TOKEN_INVALID");
  });

  it("merges chunk timestamps into one continuous quality-checked transcript", () => {
    const firstSegments = Array.from({ length: 12 }, (_, index) =>
      segment(index + 1, index * 20, (index + 1) * 20, `合成成员${index + 1}说明今天的独立工作计划和需要确认的事项。`),
    );
    const secondSegments = [
      segment(1, 0, 5, "最后一位成员补充下午安排并确认需要协助的事项。"),
    ];
    const merged = mergeMorningMeetingChunkResponses([
      response(240, firstSegments),
      response(5, secondSegments),
    ]);

    expect(merged.duration).toBe(245);
    expect(merged.segments).toHaveLength(13);
    expect(merged.segments[12]).toEqual(expect.objectContaining({ start: 240, end: 245 }));
    expect(new Set(merged.segments.map(item => item.id)).size).toBe(13);
    expect(assessMorningMeetingTranscription({
      text: merged.text,
      segments: merged.segments,
      expectedDurationSeconds: 245,
    }).accepted).toBe(true);
  });

  it.runIf(hasFfmpeg)("normalizes a real audio container before quality-checked mock transcription", async () => {
    const wav = syntheticSilentWav();
    let receivedChunkUrl = "";
    const onChunkCompleted = vi.fn();
    const result = await transcribeSegmentedMorningMeetingWithQualityRetry({
      audioUrl: `data:audio/wav;base64,${wav.toString("base64")}`,
      language: "zh",
      primaryPrompt: "synthetic prompt",
      expectedDurationSeconds: 1,
      onChunkCompleted,
      transcribeChunk: async ({ audioUrl }) => {
        receivedChunkUrl = audioUrl;
        return response(1, [segment(1, 0, 1, "合成音频仅用于验证分段转写流程完整运行。")]);
      },
    });

    expect(receivedChunkUrl.startsWith("data:audio/mpeg;base64,")).toBe(true);
    expect(result.audioChunkCount).toBe(1);
    expect(result.processingSource).toBe("server_audio");
    expect(onChunkCompleted).toHaveBeenCalledWith(1, 1);
  });

  it("uses authenticated disk-spooled multipart upload before tRPC finalization", () => {
    const endpoint = indexSource.split('"/api/morning-meeting/audio-upload"')[1]
      ?.split('app.post("/api/upload-voice"')[0] ?? "";
    const saveBlock = routerSource.split("saveDailyTeamMeeting: protectedProcedure")[1]
      ?.split("retryDailyTeamMeetingProcessing: protectedProcedure")[0] ?? "";

    expect(indexSource).toContain("multer.diskStorage");
    expect(indexSource).toContain("256 * 1024 * 1024");
    expect(endpoint.indexOf("sdk.authenticateRequest(req)")).toBeLessThan(endpoint.indexOf("morningMeetingAudioUpload.single"));
    expect(endpoint.indexOf("consumeMorningAudioUploadQuota")).toBeLessThan(endpoint.indexOf("morningMeetingAudioUpload.single"));
    expect(endpoint).toContain("validateMorningMeetingAudioFile");
    expect(endpoint).toContain("storagePutFile");
    expect(storageSource).toContain("Body: createReadStream(filePath)");
    expect(saveBlock).toContain("audioUploadToken");
    expect(saveBlock).toContain("verifyMorningMeetingAudioUploadToken(input.audioUploadToken, ctx.user.id, { allowConsumed: true })");
    expect(saveBlock).toContain("transcribeSegmentedMorningMeetingWithQualityRetry({");
    expect(mediaValidationSource).toContain("MAX_CONCURRENT_MEDIA_VALIDATIONS = 2");
    expect(mediaValidationSource).toContain('"-threads", "1"');
  });

  it("records at a bounded bitrate and keeps failed uploads retryable or downloadable", () => {
    const teamBlock = pageSource.split("const startRecording = useCallback")[1]
      ?.split("const handleDelete")[0] ?? "";

    expect(teamBlock).toContain("audioBitsPerSecond: 32_000");
    expect(teamBlock).toContain("uploadMorningMeetingAudioBlob");
    expect(teamBlock).toContain("setPendingTeamRecording");
    expect(pageSource).toContain("重新上传并保存");
    expect(pageSource).toContain("下载原录音");
    expect(pageSource).toContain("URL.createObjectURL(pendingTeamRecording.audioBlob)");
    expect(pageSource).not.toContain("早会录音为空或超过60MB");
  });

  it("installs ffmpeg in the production image and uses four-minute Whisper chunks", () => {
    expect(dockerSource).toMatch(/apt-get install -y[^\n]*ffmpeg/);
    expect(readFileSync(new URL("./morningMeetingSegmentedTranscription.ts", import.meta.url), "utf8"))
      .toContain("const CHUNK_SECONDS = 240");
  });
});
