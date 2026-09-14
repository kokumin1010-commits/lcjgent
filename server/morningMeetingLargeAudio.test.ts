import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import type { TranscriptionResponse, WhisperSegment } from "./_core/voiceTranscription";
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

const indexSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./morningMeetingRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/MorningMeeting.tsx", import.meta.url), "utf8");
const dockerSource = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("./storage.ts", import.meta.url), "utf8");

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
});

afterAll(async () => {
  ENV.cookieSecret = originalCookieSecret;
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("morning meeting large-audio safety", () => {
  it("validates the actual audio signature instead of trusting multipart MIME", async () => {
    const validPath = join(workDir, "valid.webm");
    const invalidPath = join(workDir, "invalid.webm");
    const webmHeader = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(60, 0),
    ]);
    await writeFile(validPath, webmHeader);
    await writeFile(invalidPath, Buffer.alloc(64, 0x41));

    await expect(validateMorningMeetingAudioFile({
      filePath: validPath,
      mimeType: "audio/webm;codecs=opus",
      declaredSize: webmHeader.length,
    })).resolves.toEqual({ mimeType: "audio/webm", size: webmHeader.length });

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
    });

    await expect(verifyMorningMeetingAudioUploadToken(token, 41)).resolves.toEqual(expect.objectContaining({
      userId: 41,
      mimeType: "audio/webm",
      size: 1024,
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
    const result = await transcribeSegmentedMorningMeetingWithQualityRetry({
      audioUrl: `data:audio/wav;base64,${wav.toString("base64")}`,
      language: "zh",
      primaryPrompt: "synthetic prompt",
      expectedDurationSeconds: 1,
      transcribeChunk: async ({ audioUrl }) => {
        receivedChunkUrl = audioUrl;
        return response(1, [segment(1, 0, 1, "合成音频仅用于验证分段转写流程完整运行。")]);
      },
    });

    expect(receivedChunkUrl.startsWith("data:audio/mpeg;base64,")).toBe(true);
    expect(result.audioChunkCount).toBe(1);
    expect(result.processingSource).toBe("server_audio");
  });

  it("uses authenticated disk-spooled multipart upload before tRPC finalization", () => {
    const endpoint = indexSource.split('"/api/morning-meeting/audio-upload"')[1]
      ?.split('app.post("/api/upload-voice"')[0] ?? "";
    const saveBlock = routerSource.split("saveDailyTeamMeeting: protectedProcedure")[1]
      ?.split("retryDailyTeamMeetingProcessing: protectedProcedure")[0] ?? "";

    expect(indexSource).toContain("multer.diskStorage");
    expect(indexSource).toContain("256 * 1024 * 1024");
    expect(endpoint.indexOf("sdk.authenticateRequest(req)")).toBeLessThan(endpoint.indexOf("morningMeetingAudioUpload.single"));
    expect(endpoint).toContain("validateMorningMeetingAudioFile");
    expect(endpoint).toContain("storagePutFile");
    expect(storageSource).toContain("Body: createReadStream(filePath)");
    expect(saveBlock).toContain("audioUploadToken");
    expect(saveBlock).toContain("verifyMorningMeetingAudioUploadToken(input.audioUploadToken, ctx.user.id)");
    expect(saveBlock).toContain("transcribeSegmentedMorningMeetingWithQualityRetry({");
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
