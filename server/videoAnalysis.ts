/**
 * Video Content Analysis Module
 * 
 * Provides functionality to analyze video content from LINE messages:
 * 1. Extract audio and transcribe using Whisper API
 * 2. Extract frames from video (beginning, middle, end)
 * 3. Combine transcription + frames for AI analysis
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { transcribeAudio, TranscriptionResponse, TranscriptionError } from "./_core/voiceTranscription";
import { storagePut } from "./storage";

const execAsync = promisify(exec);

// Generate a unique ID for temporary files
function generateTempId(): string {
  return `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Create a temporary directory for processing
async function createTempDir(): Promise<string> {
  const tempDir = path.join(os.tmpdir(), generateTempId());
  await fs.promises.mkdir(tempDir, { recursive: true });
  return tempDir;
}

// Clean up temporary directory
async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error("[VideoAnalysis] Failed to cleanup temp dir:", error);
  }
}

export interface ExtractedFrame {
  timestamp: number; // seconds from start
  position: "start" | "middle" | "end";
  url: string; // S3 URL of the uploaded frame
  localPath?: string; // Local path (before upload)
}

export interface VideoAnalysisResult {
  transcription?: string;
  transcriptionLanguage?: string;
  transcriptionDuration?: number;
  frames: ExtractedFrame[];
  videoDuration?: number;
  error?: string;
}

/**
 * Get video duration using FFprobe
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    return parseFloat(stdout.trim());
  } catch (error) {
    console.error("[VideoAnalysis] Failed to get video duration:", error);
    return 0;
  }
}

/**
 * Extract audio from video using FFmpeg
 * Returns the path to the extracted audio file
 */
async function extractAudio(videoPath: string, outputDir: string): Promise<string | null> {
  const audioPath = path.join(outputDir, "audio.mp3");
  
  try {
    // Extract audio as MP3 with reasonable quality
    await execAsync(
      `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -q:a 4 -y "${audioPath}" 2>/dev/null`
    );
    
    // Check if audio file was created and has content
    const stats = await fs.promises.stat(audioPath);
    if (stats.size > 0) {
      return audioPath;
    }
    
    console.log("[VideoAnalysis] No audio track in video");
    return null;
  } catch (error) {
    console.error("[VideoAnalysis] Failed to extract audio:", error);
    return null;
  }
}

/**
 * Extract frames from video at specified timestamps
 * Returns paths to extracted frame images
 */
async function extractFrames(
  videoPath: string,
  outputDir: string,
  duration: number
): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = [];
  
  // Calculate timestamps: start (1s or 10%), middle, end (1s before end or 90%)
  const timestamps: { time: number; position: "start" | "middle" | "end" }[] = [];
  
  if (duration <= 3) {
    // Very short video: just get one frame from the middle
    timestamps.push({ time: duration / 2, position: "middle" });
  } else if (duration <= 10) {
    // Short video: start and end
    timestamps.push({ time: 1, position: "start" });
    timestamps.push({ time: duration - 1, position: "end" });
  } else {
    // Normal video: start, middle, end
    timestamps.push({ time: Math.min(1, duration * 0.1), position: "start" });
    timestamps.push({ time: duration / 2, position: "middle" });
    timestamps.push({ time: Math.max(duration - 1, duration * 0.9), position: "end" });
  }
  
  for (const { time, position } of timestamps) {
    const framePath = path.join(outputDir, `frame_${position}.jpg`);
    
    try {
      // Extract a single frame at the specified timestamp
      await execAsync(
        `ffmpeg -ss ${time} -i "${videoPath}" -vframes 1 -q:v 2 -y "${framePath}" 2>/dev/null`
      );
      
      // Check if frame was created
      const stats = await fs.promises.stat(framePath);
      if (stats.size > 0) {
        frames.push({
          timestamp: time,
          position,
          url: "", // Will be filled after upload
          localPath: framePath,
        });
      }
    } catch (error) {
      console.error(`[VideoAnalysis] Failed to extract frame at ${time}s:`, error);
    }
  }
  
  return frames;
}

/**
 * Upload extracted frames to S3 storage
 */
async function uploadFramesToStorage(
  frames: ExtractedFrame[],
  messageId: string
): Promise<ExtractedFrame[]> {
  const uploadedFrames: ExtractedFrame[] = [];
  
  for (const frame of frames) {
    if (!frame.localPath) continue;
    
    try {
      const fileBuffer = await fs.promises.readFile(frame.localPath);
      const fileKey = `line-video-frames/${messageId}/${frame.position}_${Date.now()}.jpg`;
      
      const { url } = await storagePut(fileKey, fileBuffer, "image/jpeg");
      
      uploadedFrames.push({
        ...frame,
        url,
        localPath: undefined, // Remove local path after upload
      });
    } catch (error) {
      console.error(`[VideoAnalysis] Failed to upload frame ${frame.position}:`, error);
    }
  }
  
  return uploadedFrames;
}

/**
 * Upload audio to S3 and transcribe using Whisper API
 */
async function transcribeVideoAudio(
  audioPath: string,
  messageId: string
): Promise<{ transcription: string; language: string; duration: number } | null> {
  try {
    // Read audio file
    const audioBuffer = await fs.promises.readFile(audioPath);
    
    // Check file size (16MB limit for Whisper)
    const sizeMB = audioBuffer.length / (1024 * 1024);
    if (sizeMB > 16) {
      console.log(`[VideoAnalysis] Audio file too large: ${sizeMB.toFixed(2)}MB`);
      return null;
    }
    
    // Upload audio to S3
    const fileKey = `line-video-audio/${messageId}/audio_${Date.now()}.mp3`;
    const { url: audioUrl } = await storagePut(fileKey, audioBuffer, "audio/mpeg");
    
    // Transcribe using Whisper API
    const result = await transcribeAudio({
      audioUrl,
      prompt: "Transcribe this video audio. The content may be in Japanese or other languages.",
    });
    
    // Check if it's an error response
    if ("error" in result) {
      console.error("[VideoAnalysis] Transcription error:", result.error);
      return null;
    }
    
    const transcriptionResult = result as TranscriptionResponse;
    return {
      transcription: transcriptionResult.text,
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
    };
  } catch (error) {
    console.error("[VideoAnalysis] Failed to transcribe audio:", error);
    return null;
  }
}

/**
 * Main function: Analyze video content
 * 
 * @param videoBuffer - The video file as a Buffer
 * @param messageId - LINE message ID for naming uploaded files
 * @param contentType - MIME type of the video
 * @returns Analysis result with transcription and extracted frames
 */
export async function analyzeVideoContent(
  videoBuffer: Buffer,
  messageId: string,
  contentType: string = "video/mp4"
): Promise<VideoAnalysisResult> {
  const tempDir = await createTempDir();
  
  try {
    // Determine file extension from content type
    const extMap: Record<string, string> = {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/x-msvideo": "avi",
      "video/webm": "webm",
      "video/3gpp": "3gp",
    };
    const ext = extMap[contentType] || "mp4";
    
    // Write video to temp file
    const videoPath = path.join(tempDir, `video.${ext}`);
    await fs.promises.writeFile(videoPath, videoBuffer);
    
    // Get video duration
    const duration = await getVideoDuration(videoPath);
    console.log(`[VideoAnalysis] Video duration: ${duration}s`);
    
    // Extract and transcribe audio
    let transcriptionResult: { transcription: string; language: string; duration: number } | null = null;
    const audioPath = await extractAudio(videoPath, tempDir);
    if (audioPath) {
      transcriptionResult = await transcribeVideoAudio(audioPath, messageId);
    }
    
    // Extract frames
    const localFrames = await extractFrames(videoPath, tempDir, duration);
    
    // Upload frames to S3
    const uploadedFrames = await uploadFramesToStorage(localFrames, messageId);
    
    return {
      transcription: transcriptionResult?.transcription,
      transcriptionLanguage: transcriptionResult?.language,
      transcriptionDuration: transcriptionResult?.duration,
      frames: uploadedFrames,
      videoDuration: duration,
    };
  } catch (error) {
    console.error("[VideoAnalysis] Analysis failed:", error);
    return {
      frames: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    // Clean up temp directory
    await cleanupTempDir(tempDir);
  }
}

/**
 * Generate a summary prompt for AI analysis of video content
 */
export function generateVideoAnalysisPrompt(result: VideoAnalysisResult): string {
  const parts: string[] = [];
  
  parts.push("【動画コンテンツ分析】");
  
  if (result.videoDuration) {
    parts.push(`動画の長さ: ${result.videoDuration.toFixed(1)}秒`);
  }
  
  if (result.transcription) {
    parts.push(`\n【音声の文字起こし】\n${result.transcription}`);
  } else {
    parts.push("\n（音声なし、または文字起こし不可）");
  }
  
  if (result.frames.length > 0) {
    parts.push(`\n【抽出されたフレーム】${result.frames.length}枚`);
    for (const frame of result.frames) {
      parts.push(`- ${frame.position}: ${frame.timestamp.toFixed(1)}秒時点`);
    }
  }
  
  return parts.join("\n");
}
